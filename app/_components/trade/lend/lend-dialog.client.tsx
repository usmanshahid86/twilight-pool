"use client";
import Button from "@/components/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/dialog";
import { PopoverInput } from "@/components/input";
import Resource from "@/components/resource";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/tabs";
import { Text } from "@/components/typography";
import { sendLendOrder } from "@/lib/api/client";
import { queryTransactionHashByRequestId, queryTransactionHashes } from '@/lib/api/rest';
import { retry } from '@/lib/helpers';
import useGetTwilightBTCBalance from '@/lib/hooks/useGetTwilightBtcBalance';
import { useToast } from "@/lib/hooks/useToast";
import { useSessionStore } from "@/lib/providers/session";
import { useTwilightStore } from "@/lib/providers/store";
import BTC, { BTCDenoms } from "@/lib/twilight/denoms";
import { createZkLendOrder } from "@/lib/twilight/zk";
import { ZkAccount } from '@/lib/types';
import { WalletStatus } from '@cosmos-kit/core';
import { useWallet } from '@cosmos-kit/react-lite';
import Big from "big.js";
import { Loader2 } from "lucide-react";
import Link from 'next/link';
import React, { useRef, useState } from "react";

type Props = {
  children: React.ReactNode;
};

type TabType = "deposit" | "withdraw";

const LendDialog = ({ children }: Props) => {
  const { toast } = useToast();
  const privateKey = useSessionStore((state) => state.privateKey);
  const { status } = useWallet();

  const { twilightSats } =
    useGetTwilightBTCBalance();

  const zkAccounts = useTwilightStore((state) => state.zk.zkAccounts);
  const lendOrders = useTwilightStore((state) => state.lend.lends);
  const poolInfo = useTwilightStore((state) => state.lend.poolInfo);
  const addLendOrder = useTwilightStore((state) => state.lend.addLend);
  const addTransactionHistory = useTwilightStore(
    (state) => state.history.addTransaction
  );
  const updateZkAccount = useTwilightStore((state) => state.zk.updateZkAccount);

  const [currentTab, setCurrentTab] = useState<TabType>("deposit");
  const [accountSelectionType, setAccountSelectionType] = useState<"new" | "existing">("new");
  const [selectedAccountIndex, setSelectedAccountIndex] = useState<number | null>(null);
  const [depositDenom, setDepositDenom] = useState<string>("BTC");
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [selectedZkAccount, setSelectedZkAccount] = useState<ZkAccount | null>(null);

  const depositRef = useRef<HTMLInputElement>(null);
  const withdrawRef = useRef<HTMLInputElement>(null);

  // Filter accounts that have lend orders for withdrawal
  const accountsWithLends = zkAccounts.filter(account =>
    lendOrders.some(lend => lend.accountAddress === account.address && lend.orderStatus === "LENDED")
  );

  async function submitDepositForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (accountSelectionType === "new") {
      toast({
        title: "Work in progress",
        description: "Still working on this feature",
      })
      return;
    }

    if (!selectedZkAccount) {
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
      zkAccount: selectedZkAccount,
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

      addLendOrder({
        accountAddress: selectedZkAccount.address,
        uuid: data.result.id_key as string,
        orderStatus: "LENDED",
        value: depositAmount,
        timestamp: new Date(),
        apy: poolInfo?.apy,
        pool_share_price_entry: poolInfo?.pool_share_price,
        tx_hash: tx_hash,
      });

      addTransactionHistory({
        date: new Date(),
        from: selectedZkAccount.address,
        fromTag: selectedZkAccount.tag,
        to: selectedZkAccount.address,
        toTag: selectedZkAccount.tag,
        tx_hash: tx_hash,
        type: "Lend Deposit",
        value: depositAmount,
      });

      updateZkAccount(selectedZkAccount.address, {
        ...selectedZkAccount,
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

  async function submitWithdrawForm(e: React.FormEvent<HTMLFormElement>) {
    // e.preventDefault();
  }

  const calculateApproxPoolShare = () => {
    if (!depositRef.current?.value || !poolInfo?.tvl_btc) return "0";

    const amount = parseFloat(depositRef.current.value) || 0;
    const poolShare = ((amount / poolInfo.tvl_btc) * 100).toFixed(3);
    return poolShare;
  };

  const calculateApproxReward = () => {
    if (!withdrawRef.current?.value) return "0.00000000";

    // TODO: Calculate based on actual pool share price and accrued rewards
    return "0.00000000";
  };

  const getAvailableBalance = () => {
    if (currentTab === "deposit") {
      if (accountSelectionType === "new") {
        return BTC.format(new BTC("sats", Big(twilightSats))
          .convert("BTC"), "BTC")
      }

      return selectedZkAccount?.value ?
        new BTC("sats", Big(selectedZkAccount.value)).convert("BTC").toFixed(8) :
        "0.00000000";
    } else {
      // For withdraw, show lent amount for selected account
      const accountLends = lendOrders.filter(lend =>
        lend.accountAddress === selectedZkAccount?.address && lend.orderStatus === "LENDED"
      );
      const totalLent = accountLends.reduce((sum, lend) => sum + lend.value, 0);
      return new BTC("sats", Big(totalLent)).convert("BTC").toFixed(8);
    }
  };

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
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {zkAccounts.filter((account) => account.type === "Coin").map((subAccount, index) => {
                  const balance = subAccount.value ?
                    new BTC("sats", Big(subAccount.value)).convert("BTC").toFixed(8) :
                    "0.00000000";
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
            onInput={calculateApproxPoolShare}
          />
        </div>

        <div className="flex justify-between text-sm">
          <Text className="text-primary-accent">Approx Pool Share</Text>
          <Text>≈ {calculateApproxPoolShare()}%</Text>
        </div>

        <Button disabled={isSubmitLoading} type="submit" className="w-full">
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

  function renderWithdrawForm() {
    return (
      <form onSubmit={submitWithdrawForm} className="space-y-4">
        <div className="space-y-1">
          <Select
            onValueChange={(val) => {
              toast({
                title: "Work in progress",
                description: "Still working on this feature",
              })
              return;
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accountsWithLends.map((subAccount, index) => {
                const accountLends = lendOrders.filter(lend =>
                  lend.accountAddress === subAccount.address && lend.orderStatus === "LENDED"
                );
                const totalLent = accountLends.reduce((sum, lend) => sum + lend.value, 0);
                const balance = new BTC("sats", Big(totalLent)).convert("BTC").toFixed(8);
                return (
                  <SelectItem
                    value={index.toString()}
                    key={subAccount.address}
                  >
                    {subAccount.tag === "main" ? "Trading Account" : subAccount.tag} - {balance}BTC
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <Text className="text-primary-accent" asChild>
              <label htmlFor="amount-wd">Amount BTC</label>
            </Text>
            <Text className="text-primary-accent">
              Available: {getAvailableBalance()} BTC
            </Text>
          </div>

          <PopoverInput
            id="amount-wd"
            name="withdrawValue"
            onClickPopover={(e) => {
              e.preventDefault();
              if (!withdrawRef.current?.value) return;

              const toDenom = e.currentTarget.value as BTCDenoms;

              const currentValue = new BTC(
                depositDenom as BTCDenoms,
                Big(withdrawRef.current.value)
              );

              withdrawRef.current.value = currentValue
                .convert(toDenom)
                .toString();
            }}
            type="number"
            step="any"
            placeholder="0.00"
            options={["BTC", "mBTC", "sats"]}
            setSelected={setDepositDenom}
            selected={depositDenom}
            ref={withdrawRef}
            onInput={calculateApproxReward}
          />
        </div>

        <div className="flex justify-between text-sm">
          <Text className="text-primary-accent">Approx Reward</Text>
          <Text>≈ {calculateApproxReward()} BTC</Text>
        </div>

        <Button
          disabled={isSubmitLoading || accountsWithLends.length === 0}
          type="submit"
          className="w-full"
        >
          <Resource
            isLoaded={!isSubmitLoading}
            placeholder={<Loader2 className="animate-spin" />}
          >
            Withdraw
          </Resource>
        </Button>
      </form>
    );
  }

  return (
    <Dialog>
      <DialogTrigger disabled={status !== WalletStatus.Connected} asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="left-auto right-0 min-h-screen max-w-2xl translate-x-0 rounded-none border-r-0">
        <DialogTitle>Add Liquidity</DialogTitle>

        <div className="max-w-sm space-y-4">
          <Tabs defaultValue={currentTab}>
            <TabsList variant="default" className="w-full">
              <TabsTrigger
                value="deposit"
                onClick={() => setCurrentTab("deposit")}
                className="flex-1"
              >
                Deposit
              </TabsTrigger>
              <TabsTrigger
                value="withdraw"
                onClick={() => setCurrentTab("withdraw")}
                className="flex-1"
              >
                Withdraw
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {currentTab === "deposit" ? renderDepositForm() : renderWithdrawForm()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LendDialog;
