"use client";
import TransferDialog from "@/app/_components/wallet/transfer-dialog.client";
import Button from "@/components/button";
import Resource from "@/components/resource";
import { Separator } from "@/components/seperator";
import Skeleton from "@/components/skeleton";
import { Text } from "@/components/typography";
import { ZK_ACCOUNT_INDEX } from "@/lib/constants";
import useGetTwilightBTCBalance from "@/lib/hooks/useGetTwilightBtcBalance";
import { usePriceFeed } from "@/lib/providers/feed";
import { useSessionStore } from "@/lib/providers/session";
import { useTwilightStore } from "@/lib/providers/store";
import BTC from "@/lib/twilight/denoms";
import { ZkAccount } from "@/lib/types";
import Big from "big.js";
import { ArrowLeftRight } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { TransactionHistoryDataTable } from "./transaction-history/data-table";
import { transactionHistoryColumns } from "./transaction-history/columns";
import { WalletStatus } from "@cosmos-kit/core";
import { useWallet } from "@cosmos-kit/react-lite";
import useIsMounted from "@/lib/hooks/useIsMounted";
import { useToast } from "@/lib/hooks/useToast";
import { Tabs, TabsList, TabsTrigger } from '@/components/tabs';
import { AccountSummaryDataTable } from './account-summary/data-table';
import { accountSummaryColumns } from './account-summary/columns';
import { createZkAccount, createZkBurnTx } from '@/lib/twilight/zk';
import { ZkPrivateAccount } from '@/lib/zk/account';
import { verifyAccount, verifyQuisQuisTransaction } from '@/lib/twilight/zkos';
import { broadcastTradingTx } from '@/lib/api/zkos';
import { safeJSONParse } from '@/lib/helpers';
import { twilightproject } from 'twilightjs';
import Long from 'long';
import Link from 'next/link';

type TabType = "account-summary" | "transaction-history";

const Page = () => {
  const [currentTab, setCurrentTab] = useState<TabType>("account-summary");
  const isMounted = useIsMounted();
  const { toast } = useToast();

  const privateKey = useSessionStore((state) => state.privateKey);
  const btcPrice = useSessionStore((state) => state.price.btcPrice);
  const zkAccounts = useTwilightStore((state) => state.zk.zkAccounts);

  const transactionHistory = useTwilightStore(
    (state) => state.history.transactions
  );

  const tradingAccount = zkAccounts[ZK_ACCOUNT_INDEX.MAIN] as
    | ZkAccount
    | undefined;

  const tradingAccountAddress = tradingAccount ? tradingAccount.address : "";

  const { getCurrentPrice } = usePriceFeed();

  const finalPrice = getCurrentPrice() || btcPrice;

  const { twilightSats, isLoading: satsLoading } =
    useGetTwilightBTCBalance();

  const { status, mainWallet } = useWallet();

  const twilightAddress = mainWallet?.getChainWallet("nyks")?.address || "";

  // useRedirectUnconnected();

  const twilightBTCBalanceString = new BTC("sats", Big(twilightSats))
    .convert("BTC")
    .toFixed(8);

  const twilightBalanceUSDString = Big(twilightBTCBalanceString)
    .mul(finalPrice)
    .toFixed(2);

  const zkAccountSatsBalance = zkAccounts.reduce((acc, account) => {
    acc += account.value || 0;

    return acc;
  }, 0);

  const zkAccountBTCString = new BTC("sats", Big(zkAccountSatsBalance))
    .convert("BTC")
    .toFixed(8);

  const zkAccountBTCUSDString = Big(zkAccountBTCString)
    .mul(finalPrice)
    .toFixed(2);

  const totalSatsBalance = Big(twilightSats).plus(zkAccountSatsBalance || 0);

  const totalBTCBalanceString = new BTC("sats", totalSatsBalance)
    .convert("BTC")
    .toFixed(8);

  const totalBalanceUSDString = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Big(totalBTCBalanceString)
    .mul(finalPrice).toNumber())

  const chainWallet = mainWallet?.getChainWallet("nyks");

  const addTransactionHistory = useTwilightStore(
    (state) => state.history.addTransaction
  );

  const removeZkAccount = useTwilightStore((state) => state.zk.removeZkAccount);

  const subaccountTransfer = useCallback(async (zkAccount: ZkAccount) => {
    if (!twilightAddress || !chainWallet || !zkAccount.value || !privateKey) {
      return;
    }

    const transientZkAccount = await createZkAccount({
      tag: Math.random().toString(36).substring(2, 15),
      signature: privateKey,
    });

    const senderZkPrivateAccount = await ZkPrivateAccount.create({
      signature: privateKey,
      existingAccount: zkAccount,
    });

    const privateTxSingleResult =
      await senderZkPrivateAccount.privateTxSingle(
        zkAccount.value,
        transientZkAccount.address
      );

    if (!privateTxSingleResult.success) {
      return {
        success: false,
        message: privateTxSingleResult.message,
      }
    }

    const {
      scalar: updatedTransientScalar,
      txId,
      updatedAddress: updatedTransientAddress,
    } = privateTxSingleResult.data;

    console.log("txId", txId, "updatedAddess", updatedTransientAddress);

    console.log(
      "transient zkAccount balance =",
      zkAccount.value,
    );

    const {
      success,
      msg: zkBurnMsg,
      zkAccountHex,
    } = await createZkBurnTx({
      signature: privateKey,
      zkAccount: {
        tag: zkAccount.tag,
        address: updatedTransientAddress,
        scalar: updatedTransientScalar,
        isOnChain: true,
        value: zkAccount.value,
        type: "Coin",
      },
      initZkAccountAddress: transientZkAccount.address,
    });

    if (!success || !zkBurnMsg || !zkAccountHex) {
      return {
        success: false,
        message: "Error creating zkBurnTx msg",
      }
    }

    console.log({
      zkAccountHex: zkAccountHex,
      balance: zkAccount.value,
      signature: privateKey,
      initZkAccountAddress: transientZkAccount.address,
    });

    const isAccountValid = await verifyAccount({
      zkAccountHex: zkAccountHex,
      balance: zkAccount.value,
      signature: privateKey,
    });

    console.log("isAccountValid", isAccountValid);

    toast({
      title: "Broadcasting transfer",
      description:
        "Please do not close this page while your BTC is being transferred to your funding account...",
    });

    const txValidMessage = await verifyQuisQuisTransaction({
      tx: zkBurnMsg,
    });

    console.log("txValidMessage", txValidMessage);

    const tradingTxResString = await broadcastTradingTx(
      zkBurnMsg,
      twilightAddress
    );

    console.log("zkBurnMsg tradingTxResString >>"), tradingTxResString;

    const tradingTxRes = safeJSONParse(tradingTxResString as string);

    if (!tradingTxRes.success || Object.hasOwn(tradingTxRes, "error")) {
      toast({
        variant: "error",
        title: "An error has occurred",
        description: "Please try again later.",
      });
      console.error("error broadcasting zkBurnTx msg", tradingTxRes);
      return {
        success: false,
        message: "Error broadcasting zkBurnTx msg",
      }
    }

    console.log("tradingTxRes", tradingTxRes);

    const { mintBurnTradingBtc } =
      twilightproject.nyks.zkos.MessageComposer.withTypeUrl;

    const stargateClient = await chainWallet.getSigningStargateClient();

    console.log({
      btcValue: Long.fromNumber(zkAccount.value),
      encryptScalar: updatedTransientScalar,
      mintOrBurn: false,
      qqAccount: zkAccountHex,
      twilightAddress,
    });

    const mintBurnMsg = mintBurnTradingBtc({
      btcValue: Long.fromNumber(zkAccount.value),
      encryptScalar: updatedTransientScalar,
      mintOrBurn: false,
      qqAccount: zkAccountHex,
      twilightAddress,
    });

    console.log("mintBurnMsg", mintBurnMsg);
    const mintBurnRes = await stargateClient.signAndBroadcast(
      twilightAddress,
      [mintBurnMsg],
      "auto"
    );

    addTransactionHistory({
      date: new Date(),
      from: zkAccount.address,
      fromTag: zkAccount.tag,
      to: twilightAddress,
      toTag: "Funding",
      tx_hash: mintBurnRes.transactionHash,
      type: "Burn",
      value: zkAccount.value,
    });

    removeZkAccount(zkAccount);

    toast({
      title: "Success",
      description: (
        <div className="opacity-90">
          {`Successfully sent ${new BTC("sats", Big(zkAccount.value))
            .convert("BTC")
            .toString()} BTC to Funding Account. `}
          <Link
            href={`${process.env.NEXT_PUBLIC_EXPLORER_URL as string}/tx/${mintBurnRes.transactionHash}`}
            target={"_blank"}
            className="text-sm underline hover:opacity-100"
          >
            Explorer link
          </Link>
        </div>
      ),
    });


  }, [toast, privateKey, twilightAddress, removeZkAccount, addTransactionHistory, chainWallet]);

  function renderTableContent() {
    switch (currentTab) {
      case "account-summary":
        return (
          <div>
            <AccountSummaryDataTable
              columns={accountSummaryColumns}
              data={zkAccounts}
              subaccountTransfer={subaccountTransfer}
            />
          </div>

        );
      case "transaction-history":
        return (
          <TransactionHistoryDataTable
            columns={transactionHistoryColumns}
            data={transactionHistory}
          />
        );
    }
  }

  return (
    <div className="mx-4 mt-4 space-y-8 md:mx-8">
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-7 md:space-y-4 border rounded-md p-4 md:p-6">
          <div className="space-y-1">
            <Text heading="h1" className="mb-0 text-lg font-normal">
              Assets Overview
            </Text>
            <div>
              <Resource
                isLoaded={
                  !satsLoading
                }
                placeholder={<Skeleton className="h-10 w-[200px]" />}
              >
                <Text className="text-sm md:text-4xl">
                  {totalBTCBalanceString}
                  <span className="ml-0 inline-flex text-sm md:ml-1">BTC</span>
                </Text>
              </Resource>

              <Text className="text-xs text-primary-accent">
                = {totalBalanceUSDString} USD
              </Text>
            </div>
          </div>


          {twilightAddress && (
            <div className="space-y-1">
              <Text className="text-sm">Twilight Address</Text>
              <Text
                onClick={(e) => {
                  if (!twilightAddress) return;
                  e.preventDefault();
                  toast({
                    title: "Copied to clipboard",
                    description:
                      "Copied your twilight address to the clipboard",
                  });
                  navigator.clipboard.writeText(twilightAddress);
                }}
                className="cursor-pointer text-xs text-primary-accent"
              >
                {twilightAddress}
              </Text>
            </div>
          )}
        </div>
        <div className="col-span-5 flex flex-col rounded-md p-4 md:p-6 border">
          <Text heading="h2" className="text-lg font-normal">
            My Assets
          </Text>
          <div className="space-y-4">
            <div className="flex w-full justify-between space-x-2">
              <Text className="text-sm md:text-base">Funding</Text>
              <div className="min-w-[140px]">
                <Resource
                  isLoaded={
                    status === WalletStatus.Connected
                  }
                  placeholder={<Skeleton className="h-5 w-[140px]" />}
                >
                  <Text className="text-sm text-primary/80 md:text-base">
                    {twilightBTCBalanceString} BTC
                  </Text>
                </Resource>
                <Resource
                  isLoaded={
                    status === WalletStatus.Connected &&
                    finalPrice !== 0
                  }
                  placeholder={<Skeleton className="mt-1 h-4 w-[80px]" />}
                >
                  <Text className="text-xs text-primary-accent">
                    = {twilightBalanceUSDString} USD
                  </Text>
                </Resource>
              </div>
              <div className="flex flex-row space-x-2">
                <TransferDialog
                  tradingAccountAddress={tradingAccountAddress}
                  defaultAccount="funding"
                >
                  <Button disabled={totalSatsBalance.lt(1)} variant="ui" size="icon">
                    <ArrowLeftRight className="h-4 w-4" />
                  </Button>
                </TransferDialog>
              </div>
            </div>

            <Separator />

            <div className="flex w-full justify-between space-x-2">
              <Text className="text-sm md:text-base">Trading</Text>
              <div className="min-w-[140px]">
                <Resource
                  isLoaded={status === WalletStatus.Connected && isMounted}
                  placeholder={<Skeleton className="h-5 w-[140px]" />}
                >
                  <Text className="text-sm text-primary/80 md:text-base">
                    {zkAccountBTCString} BTC
                  </Text>
                </Resource>
                <Resource
                  isLoaded={
                    status === WalletStatus.Connected &&
                    isMounted &&
                    finalPrice !== 0
                  }
                  placeholder={<Skeleton className="mt-1 h-4 w-[80px]" />}
                >
                  <Text className="text-xs text-primary-accent">
                    = {zkAccountBTCUSDString} USD
                  </Text>
                </Resource>
              </div>
              <div className="flex flex-row space-x-2">
                <TransferDialog
                  tradingAccountAddress={tradingAccountAddress}
                  defaultAccount="trading"
                >
                  <Button disabled={totalSatsBalance.lt(1)} variant="ui" size="icon">
                    <ArrowLeftRight className="h-4 w-4" />
                  </Button>
                </TransferDialog>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-1 md:space-y-2 border rounded-md p-4 md:p-6">
        <div className="flex w-full border-b justify-between">
          <Tabs defaultValue={currentTab}>
            <TabsList className="flex w-full border-b-0" variant="underline">
              <TabsTrigger
                onClick={() => setCurrentTab("account-summary")}
                value="account-summary"
                variant="underline"
              >
                Account Summary
              </TabsTrigger>
              <TabsTrigger
                onClick={() => setCurrentTab("transaction-history")}
                value="transaction-history"
                variant="underline"
              >
                Transaction History
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {/* <div className="flex space-x-2">
            <button className="text-xs">Import</button>
            <button className="text-xs">Export</button>
          </div> */}
        </div>

        <div className="h-full min-h-[500px] w-full py-1">
          {renderTableContent()}
        </div>
      </div>
    </div>
  );
};

export default Page;
