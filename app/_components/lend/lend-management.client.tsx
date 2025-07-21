"use client";
import Button from "@/components/button";
import { PopoverInput } from "@/components/input";
import Resource from "@/components/resource";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/select";
import { Text } from "@/components/typography";
import { sendLendOrder } from "@/lib/api/client";
import { queryLendOrder } from '@/lib/api/relayer';
import { queryTransactionHashByRequestId, queryTransactionHashes } from '@/lib/api/rest';
import { retry } from '@/lib/helpers';
import useGetTwilightBTCBalance from '@/lib/hooks/useGetTwilightBtcBalance';
import { useToast } from "@/lib/hooks/useToast";
import { useSessionStore } from "@/lib/providers/session";
import { useTwilightStore } from "@/lib/providers/store";
import BTC, { BTCDenoms } from "@/lib/twilight/denoms";
import { createFundingToTradingTransferMsg } from '@/lib/twilight/wallet';
import { createZkAccount, createZkAccountWithBalance, createZkLendOrder } from "@/lib/twilight/zk";
import { createQueryLendOrderMsg } from '@/lib/twilight/zkos';
import { ZkAccount } from '@/lib/types';
import { calculateFee, GasPrice } from '@cosmjs/stargate';
import { WalletStatus } from '@cosmos-kit/core';
import { useWallet } from '@cosmos-kit/react-lite';
import Big from "big.js";
import { Loader2 } from "lucide-react";
import Link from 'next/link';
import React, { useCallback, useMemo, useRef, useState } from "react";

const LendManagement = () => {
  const { toast } = useToast();
  const privateKey = useSessionStore((state) => state.privateKey);
  const { status } = useWallet();

  const { twilightSats } =
    useGetTwilightBTCBalance();

  const zkAccounts = useTwilightStore((state) => state.zk.zkAccounts);
  const addZkAccount = useTwilightStore((state) => state.zk.addZkAccount);
  const lendOrders = useTwilightStore((state) => state.lend.lends);
  const poolInfo = useTwilightStore((state) => state.lend.poolInfo);

  const [approxPoolShare, setApproxPoolShare] = useState<string>("0.00000000");

  const addLendOrder = useTwilightStore((state) => state.lend.addLend);
  const addTransactionHistory = useTwilightStore(
    (state) => state.history.addTransaction
  );
  const updateZkAccount = useTwilightStore((state) => state.zk.updateZkAccount);

  const [accountSelectionType, setAccountSelectionType] = useState<"new" | "existing">("new");
  const [selectedAccountIndex, setSelectedAccountIndex] = useState<number | null>(null);
  const [depositDenom, setDepositDenom] = useState<string>("BTC");
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  const { mainWallet } = useWallet();

  const selectedZkAccount = useMemo(() => {
    if (selectedAccountIndex === null) return null;
    return zkAccounts[selectedAccountIndex];
  }, [selectedAccountIndex, zkAccounts]);

  const depositRef = useRef<HTMLInputElement>(null);

  async function submitDepositForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    let zkAccountToUse: ZkAccount | null = selectedZkAccount;

    if (accountSelectionType === "new") {
      toast({
        title: "Approval Pending",
        description: "Please approve the transaction in your wallet.",
      })

      const tag = `Subaccount ${zkAccounts.length}`

      const chainWallet = mainWallet?.getChainWallet("nyks");

      if (!chainWallet) {
        toast({
          title: "Wallet is not connected",
          description: "Please connect your wallet to deposit.",
        })
        return;
      }

      if (!depositRef.current?.value) {
        toast({
          title: "Invalid amount",
          description: "Please enter an amount to deposit.",
        })
        return;
      }

      const twilightAddress = chainWallet.address;

      if (!twilightAddress) {
        console.error("no twilightAddress");
        return;
      }

      setIsSubmitLoading(true);

      const transferAmount = new BTC(
        depositDenom as BTCDenoms,
        Big(depositRef.current.value)
      )
        .convert("sats")
        .toNumber();

      const stargateClient = await chainWallet.getSigningStargateClient();

      console.log("funding transfer signature", privateKey);
      const { account: newTradingAccount, accountHex: newTradingAccountHex } =
        await createZkAccountWithBalance({
          tag: tag,
          balance: transferAmount,
          signature: privateKey,
        });

      const msg = await createFundingToTradingTransferMsg({
        twilightAddress,
        transferAmount,
        account: newTradingAccount,
        accountHex: newTradingAccountHex,
      });

      console.log("msg", msg);

      const res = await stargateClient.signAndBroadcast(
        twilightAddress,
        [msg],
        "auto"
      );

      console.log("sent sats from funding to trading", transferAmount);
      console.log("res", res);

      zkAccountToUse = {
        scalar: newTradingAccount.scalar,
        type: "Coin",
        address: newTradingAccount.address,
        tag: tag,
        isOnChain: true,
        value: transferAmount,
      }
    }

    if (!zkAccountToUse) {
      toast({
        variant: "error",
        title: "Error",
        description: "Please select an account",
      });
      return;
    }

    if (!depositRef.current?.value) {
      toast({
        variant: "error",
        title: "Error",
        description: "Invalid BTC amount",
      });
      return;
    }

    const depositAmount = new BTC(
      depositDenom as BTCDenoms,
      Big(depositRef.current.value)
    )
      .convert("sats")
      .toNumber();

    setIsSubmitLoading(true);

    const { success, msg } = await createZkLendOrder({
      zkAccount: zkAccountToUse,
      deposit: depositAmount,
      signature: privateKey,
    });

    if (!success || !msg) {
      toast({
        variant: "error",
        title: "Unable to submit lend order",
        description: "An error has occurred, try again later.",
      });
      setIsSubmitLoading(false);
      return;
    }

    const data = await sendLendOrder(msg);

    if (data.result && data.result.id_key) {
      const lendOrderRes = await retry<
        ReturnType<typeof queryTransactionHashes>,
        string
      >(
        queryTransactionHashByRequestId,
        9,
        data.result.id_key,
        2500,
        (txHash) => {
          const found = txHash.result.find(
            (tx) => tx.order_status === "FILLED"
          );

          return found ? true : false;
        }
      );

      if (!lendOrderRes.success) {
        console.error("lend order deposit not successful");
        toast({
          variant: "error",
          title: "Unable to submit lend order",
          description: "An error has occurred, try again later.",
        });
        setIsSubmitLoading(false);
        return;
      }

      const lendOrderData = lendOrderRes.data.result.find(
        (tx) => tx.order_status === "FILLED"
      );

      const tx_hash = lendOrderData?.tx_hash;

      if (!tx_hash) {
        toast({
          variant: "error",
          title: "Unable to submit lend order",
          description: "An error has occurred, try again later.",
        });
        setIsSubmitLoading(false);
        return;
      }

      toast({
        title: "Success",
        description: <div className="opacity-90">
          {`Successfully submitted lend order for ${new BTC("sats", Big(depositAmount))
            .convert("BTC")
            .toString()} BTC. `}
          <Link
            href={`https://explorer.twilight.rest/nyks/tx/${tx_hash}`}
            target={"_blank"}
            className="text-sm underline hover:opacity-100"
          >
            Explorer link
          </Link>
        </div>
      });

      const queryLendOrderMsg = await createQueryLendOrderMsg({
        address: zkAccountToUse.address,
        signature: privateKey,
        orderStatus: "FILLED",
      });

      const queryLendOrderRes = await queryLendOrder(queryLendOrderMsg);
      console.log(queryLendOrderRes);

      if (!queryLendOrderRes) {
        console.error(queryLendOrderRes);
        toast({
          variant: "error",
          title: "Unable to query lend order",
          description: "An error has occurred, try again later.",
        });
        setIsSubmitLoading(false);
        return;
      }

      addLendOrder({
        accountAddress: zkAccountToUse.address,
        uuid: data.result.id_key as string,
        orderStatus: "LENDED",
        value: depositAmount,
        timestamp: new Date(),
        apy: poolInfo?.apy,
        tx_hash: tx_hash,
        npoolshare: Number(queryLendOrderRes.result.npoolshare)
      });

      addTransactionHistory({
        date: new Date(),
        from: zkAccountToUse.address,
        fromTag: zkAccountToUse.tag,
        to: zkAccountToUse.address,
        toTag: zkAccountToUse.tag,
        tx_hash: tx_hash,
        type: "Lend Deposit",
        value: depositAmount,
      });

      updateZkAccount(zkAccountToUse.address, {
        ...zkAccountToUse,
        type: "Memo",
      });

      // Reset form
      if (depositRef.current) {
        depositRef.current.value = "";
      }

    } else {
      toast({
        variant: "error",
        title: "Unable to submit lend order",
        description: "An error has occurred, try again later.",
      });
    }

    setIsSubmitLoading(false);
  }

  const getAvailableBalance = useCallback(() => {
    if (accountSelectionType === "new") {
      return BTC.format(new BTC("sats", Big(twilightSats))
        .convert("BTC"), "BTC")
    }

    return selectedZkAccount?.value ?
      new BTC("sats", Big(selectedZkAccount.value)).convert("BTC").toFixed(8) :
      "0.00000000";

  }, [accountSelectionType, selectedZkAccount, twilightSats])

  const calculateApproxPoolShare = useCallback((value: string) => {
    const amount = Big(value || 0).toNumber()
    const sats = new BTC(depositDenom as BTCDenoms, Big(amount)).convert("sats").toNumber()

    const poolShare = (sats / (poolInfo?.pool_share || 0));

    setApproxPoolShare(poolShare.toFixed(8))
  }, [depositDenom, poolInfo?.pool_share])

  function renderDepositForm() {
    return (
      <form onSubmit={submitDepositForm} className="space-y-4">
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="account-type"
              value="new"
              checked={accountSelectionType === "new"}
              onChange={(e) => setAccountSelectionType(e.target.value as "new" | "existing")}
              className="text-theme"
            />
            New Account
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="account-type"
              value="existing"
              checked={accountSelectionType === "existing"}
              onChange={(e) => setAccountSelectionType(e.target.value as "new" | "existing")}
              className="text-theme"
            />
            Select Account
          </label>
        </div>

        {accountSelectionType === "existing" && (
          <div className="space-y-1">
            <Select
              onValueChange={(val) => {
                const account = zkAccounts.find((account) => account.address === val);
                if (account) {
                  setSelectedAccountIndex(zkAccounts.indexOf(account));
                  if (depositRef.current) {
                    const currentValue = new BTC("sats", Big(account?.value || 0)).convert(depositDenom as BTCDenoms).toString();
                    depositRef.current.value = currentValue;
                    calculateApproxPoolShare(currentValue);
                  }
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {zkAccounts
                  .filter((account) => account.type === "Coin" && (account.value ?? 0) > 0)
                  .map((subAccount) => {
                    const balance = typeof subAccount.value === "number"
                      ? new BTC("sats", Big(subAccount.value)).convert("BTC").toFixed(8)
                      : "0.00000000";
                    return (
                      <SelectItem
                        value={subAccount.address}
                        key={subAccount.address}
                      >
                        {subAccount.tag === "main" ? "Trading Account" : subAccount.tag} - {balance}BTC
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <Text className="text-primary-accent" asChild>
              <label htmlFor="amount-dep">Amount BTC</label>
            </Text>
            <Text className="text-primary-accent">
              Available: {getAvailableBalance()} BTC
            </Text>
          </div>

          <PopoverInput
            id="amount-dep"
            name="depositValue"
            onClickPopover={(e) => {
              e.preventDefault();
              if (!depositRef.current?.value) return;

              const toDenom = e.currentTarget.value as BTCDenoms;

              const currentValue = new BTC(
                depositDenom as BTCDenoms,
                Big(depositRef.current.value)
              );

              depositRef.current.value = currentValue
                .convert(toDenom)
                .toString();
            }}
            type="number"
            step="any"
            placeholder="0.00"
            options={["BTC", "mBTC", "sats"]}
            setSelected={setDepositDenom}
            selected={depositDenom}
            ref={depositRef}
            readOnly={accountSelectionType === "existing"}
            onChange={(e) => {
              const value = e.target.value;
              calculateApproxPoolShare(value);
            }}
          />
        </div>

        <div className="flex justify-between text-sm">
          <Text className="text-primary-accent">Approx Pool Share</Text>
          <Text>≈ {approxPoolShare}</Text>
        </div>

        <Button disabled={isSubmitLoading || status !== WalletStatus.Connected} type="submit" className="w-full">
          <Resource
            isLoaded={!isSubmitLoading}
            placeholder={<Loader2 className="animate-spin" />}
          >
            Deposit
          </Resource>
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      {renderDepositForm()}
    </div>
  );
};

export default LendManagement; 