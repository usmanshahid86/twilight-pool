import Button from "@/components/button";
import ExchangeResource from "@/components/exchange-resource";
import { Input, NumberInput } from "@/components/input";
import { Slider } from '@/components/slider';
import { Text } from "@/components/typography";
import { sendTradeOrder } from "@/lib/api/client";
import { queryTradeOrder } from '@/lib/api/relayer';
import { TransactionHash, queryTransactionHashes } from "@/lib/api/rest";
import cn from "@/lib/cn";
import useGetTwilightBTCBalance from '@/lib/hooks/useGetTwilightBtcBalance';
import { useToast } from "@/lib/hooks/useToast";
import { usePriceFeed } from "@/lib/providers/feed";
import { useGrid } from "@/lib/providers/grid";
import { useSessionStore } from "@/lib/providers/session";
import { useTwilightStore } from "@/lib/providers/store";
import { useTwilight } from "@/lib/providers/twilight";
import BTC, { BTCDenoms } from "@/lib/twilight/denoms";
import { createFundingToTradingTransferMsg } from '@/lib/twilight/wallet';
import { createZkAccountWithBalance, createZkOrder } from "@/lib/twilight/zk";
import { createQueryTradeOrderMsg } from '@/lib/twilight/zkos';
import { ZkAccount } from '@/lib/types';
import { WalletStatus } from "@cosmos-kit/core";
import { useWallet } from "@cosmos-kit/react-lite";
import Big from "big.js";
import dayjs from 'dayjs';
import { Loader2 } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const OrderMarketForm = () => {
  const { width } = useGrid();

  const privateKey = useSessionStore((state) => state.privateKey);

  const { twilightSats } =
    useGetTwilightBTCBalance();

  const twilightBTCBalanceString = new BTC("sats", Big(twilightSats))
    .convert("BTC")
    .toString();

  const { hasRegisteredBTC } = useTwilight();
  const { getCurrentPrice } = usePriceFeed();
  const currentPrice = getCurrentPrice()

  const { toast } = useToast();

  const { status } = useWallet();

  const btcRef = useRef<HTMLInputElement>(null);
  const usdRef = useRef<HTMLInputElement>(null);
  const leverageRef = useRef<HTMLInputElement>(null);

  const zkAccounts = useTwilightStore((state) => state.zk.zkAccounts);

  const { mainWallet } = useWallet();

  const addTrade = useTwilightStore((state) => state.trade.addTrade);
  const updateZkAccount = useTwilightStore((state) => state.zk.updateZkAccount)
  const addTradeHistory = useTwilightStore((state) => state.trade_history.addTrade)

  const addZkAccount = useTwilightStore((state) => state.zk.addZkAccount);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usdAmount, setUsdAmount] = useState<string>("");
  const [leverage, setLeverage] = useState<string>("1");

  const [percent, setPercent] = useState<number>(0);

  const updatePercent = useCallback((value: number) => {
    const finalValue = Math.max(0, Math.min(value, 100))
    setPercent(finalValue);
  }, [])

  const positionSize = useMemo(() => {
    if (!usdAmount || !leverage) {
      return "0.00";
    }

    try {
      const usdAmountBig = Big(usdAmount || "0");
      const leverageBig = Big(leverage || "1");

      if (usdAmountBig.lte(0) || leverageBig.lte(0)) {
        return "0.00";
      }

      Big.DP = 2;
      return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .format(Number(usdAmountBig.mul(leverageBig).toFixed(2)));
    } catch (error) {
      console.error("Error calculating position size:", error);
      return "0.00";
    }
  }, [usdAmount, leverage]);

  async function submitMarket(type: "SELL" | "BUY") {
    const positionType = type === "BUY" ? "LONG" : "SHORT";
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

    if (!btcRef.current?.value) {
      toast({
        title: "Invalid amount",
        description: "Please enter an amount to trade.",
      })
      return;
    }

    const btcValue = btcRef.current?.value;

    if (btcValue && Big(btcValue).lte(0.00001)) {
      toast({
        title: "Invalid amount",
        description: "Please enter an amount greater than 0.00001 BTC.",
      })
      return;
    }

    const twilightAddress = chainWallet.address;

    if (!twilightAddress) {
      console.error("no twilightAddress");
      return;
    }

    try {
      if (!hasRegisteredBTC) return;

      const satsValue = new BTC("BTC", Big(btcValue))
        .convert("sats")
        .toNumber();

      if (twilightSats < satsValue) {
        toast({
          variant: "error",
          title: "Insufficient funds",
          description: "You do not have enough funds to submit this trade order",
        });
        return;
      }

      setIsSubmitting(true);

      toast({
        title: "Submitting deposit",
        description: "Please do not close this page while your deposit is being submitted...",
      })

      const stargateClient = await chainWallet.getSigningStargateClient();

      console.log("funding transfer signature", privateKey);
      const { account: newTradingAccount, accountHex: newTradingAccountHex } =
        await createZkAccountWithBalance({
          tag: tag,
          balance: satsValue,
          signature: privateKey,
        });

      const depositMsg = await createFundingToTradingTransferMsg({
        twilightAddress,
        transferAmount: satsValue,
        account: newTradingAccount,
        accountHex: newTradingAccountHex,
      });

      console.log("msg", depositMsg);

      const res = await stargateClient.signAndBroadcast(
        twilightAddress,
        [depositMsg],
        "auto"
      );

      console.log("sent sats from funding to trading", satsValue);
      console.log("res", res)

      const newZkAccount = {
        scalar: newTradingAccount.scalar,
        type: "Coin",
        address: newTradingAccount.address,
        tag: tag,
        isOnChain: true,
        value: satsValue,
      }

      addZkAccount(newZkAccount as ZkAccount);

      const leverage = parseInt(leverageRef.current?.value || "1");

      const { success, msg } = await createZkOrder({
        leverage: leverage,
        orderType: "MARKET",
        positionType,
        signature: privateKey,
        timebounds: 1,
        zkAccount: newZkAccount as ZkAccount,
        value: satsValue,
      });

      if (!success || !msg) {
        toast({
          variant: "error",
          title: "Unable to submit trade order",
          description: "An error has occurred, try again later.",
        });
        setIsSubmitting(false);
        return;
      }

      const data = await sendTradeOrder(msg);

      if (data.result && data.result.id_key) {
        console.log(data);
        toast({
          title: "Submitting order",
          description: "Order is being submitted...",
        });

        let retries = 0;
        let orderData: TransactionHash | undefined = undefined;

        while (!orderData) {
          try {
            if (retries > 4) break;
            const txHashesRes = await queryTransactionHashes(
              newZkAccount.address
            );

            if (!txHashesRes.result) {
              retries += 1;
              continue;
            }

            orderData = txHashesRes.result[0] as TransactionHash;
          } catch (err) {
            console.error(err)
            break;
          }
        }

        if (!orderData || orderData.tx_hash.includes("Error")) {
          toast({
            variant: "error",
            title: "Error",
            description: "Error with creating trade order",
          });

          setIsSubmitting(false);
          return;
        }

        console.log("orderData", orderData);

        toast({
          title: "Success",
          description: (
            <div className="flex space-x-1 opacity-90">
              Successfully submitted trade order.{" "}
              <Button
                variant="link"
                className="inline-flex text-sm opacity-90 hover:opacity-100"
                asChild
              >
                <Link
                  href={`${process.env.NEXT_PUBLIC_EXPLORER_URL as string}/tx/${orderData.tx_hash}`}
                  target={"_blank"}
                >
                  Explorer link
                </Link>
              </Button>
            </div>
          ),
        });

        const queryTradeOrderMsg = await createQueryTradeOrderMsg({
          address: newZkAccount.address,
          orderStatus: orderData.order_status,
          signature: privateKey,
        });

        console.log("queryTradeOrderMsg", queryTradeOrderMsg);

        const queryTradeOrderRes = await queryTradeOrder(queryTradeOrderMsg);

        if (!queryTradeOrderRes) {
          throw new Error("Failed to query trade order");
        }

        const traderOrderInfo = queryTradeOrderRes.result;

        console.log("traderOrderInfo", traderOrderInfo)

        const newTradeData = {
          accountAddress: newZkAccount.address,
          orderStatus: orderData.order_status,
          positionType,
          orderType: orderData.order_type,
          tx_hash: orderData.tx_hash,
          uuid: orderData.order_id,
          value: satsValue,
          output: orderData.output,
          entryPrice: new Big(traderOrderInfo.entryprice).toNumber(),
          leverage: leverage,
          isOpen: true,
          date: dayjs(traderOrderInfo.timestamp).toDate(),
          availableMargin: new Big(traderOrderInfo.available_margin).toNumber(),
          bankruptcyPrice: new Big(traderOrderInfo.bankruptcy_price).toNumber(),
          bankruptcyValue: new Big(traderOrderInfo.bankruptcy_value).toNumber(),
          entryNonce: traderOrderInfo.entry_nonce,
          entrySequence: traderOrderInfo.entry_sequence,
          executionPrice: new Big(traderOrderInfo.execution_price).toNumber(),
          initialMargin: new Big(traderOrderInfo.initial_margin).toNumber(),
          liquidationPrice: new Big(traderOrderInfo.liquidation_price).toNumber(),
          maintenanceMargin: new Big(traderOrderInfo.maintenance_margin).toNumber(),
          positionSize: new Big(traderOrderInfo.positionsize).toNumber(),
          settlementPrice: new Big(traderOrderInfo.settlement_price).toNumber(),
          unrealizedPnl: new Big(traderOrderInfo.unrealized_pnl).toNumber(),
          feeFilled: new Big(traderOrderInfo.fee_filled).toNumber(),
          feeSettled: new Big(traderOrderInfo.fee_settled).toNumber(),
        }

        addTrade(newTradeData);
        addTradeHistory(newTradeData);

        updateZkAccount(newZkAccount.address, {
          ...newZkAccount,
          type: "Memo",
        });

      } else {
        toast({
          variant: "error",
          title: "Unable to submit trade order",
          description: "An error has occurred, try again later.",
        });
      }

      setIsSubmitting(false);
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
    // todo: get this data and put it into "my trades"
  }

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-col space-y-2 px-3"
    >
      <div className="flex justify-between text-xs"><span className="opacity-80">Avbl to trade</span><span>{twilightBTCBalanceString} BTC</span></div>
      <div className="flex justify-between space-x-4">
        <div>
          <Text
            className={cn("mb-1 text-sm opacity-80", width < 350 && "text-xs")}
            asChild
          >
            <label htmlFor="input-market-amount-btc">Amount (BTC)</label>
          </Text>
          <Input
            type="text"
            id="input-market-amount-btc"
            placeholder="0.000"
            ref={btcRef}
            onChange={(e) => {
              if (!usdRef.current) return;

              let value = e.currentTarget.value;

              // Remove any non-numeric characters except decimal point
              value = value.replace(/[^0-9.]/g, '');

              // Prevent multiple decimal points
              const decimalCount = (value.match(/\./g) || []).length;
              if (decimalCount > 1) {
                const firstDecimalIndex = value.indexOf('.');
                value = value.substring(0, firstDecimalIndex + 1) + value.substring(firstDecimalIndex + 1).replace(/\./g, '');
              }

              // Limit to 8 decimal places (BTC precision)
              const decimalIndex = value.indexOf('.');
              if (decimalIndex !== -1 && value.substring(decimalIndex + 1).length > 8) {
                value = value.substring(0, decimalIndex + 9);
              }

              // Prevent leading zeros except for decimal values
              if (value.length > 1 && value[0] === '0' && value[1] !== '.') {
                value = value.substring(1);
              }

              // Update the input field value
              e.currentTarget.value = value;

              if (!value || Big(value).lte(0)) {
                usdRef.current.value = "";
                setUsdAmount("");
                return;
              }

              Big.DP = 2;

              const usdValue = Big(currentPrice)
                .mul(value)
                .toFixed(2);
              usdRef.current.value = usdValue;
              setUsdAmount(usdValue);

              updatePercent(Big(value).div(Big(twilightBTCBalanceString)).mul(100).toNumber());
            }}
          />
        </div>
        <div>
          <Text
            className={cn("mb-1 text-sm opacity-80", width < 350 && "text-xs")}
            asChild
          >
            <label htmlFor="input-market-amount-usd">Amount (USD)</label>
          </Text>
          <Input
            type="text"
            id="input-market-amount-usd"
            placeholder="$0.00"
            ref={usdRef}
            onChange={(e) => {
              if (!btcRef.current) return;

              const usdInput = e.currentTarget.value;
              setUsdAmount(usdInput);

              if (
                !usdInput ||
                Big(usdInput).eq(0) ||
                Big(usdInput).lt(0)
              ) {
                btcRef.current.value = "";
                return;
              }
              Big.DP = 8;

              btcRef.current.value = new Big(usdInput)
                .div(currentPrice || 1)
                .toString();
            }}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Slider onValueChange={(value) => {
          if (!btcRef.current || !usdRef.current) return;
          const newBtcAmount = new Big(twilightBTCBalanceString).mul(value[0] / 100).toString();
          btcRef.current.value = newBtcAmount;
          setPercent(value[0])

          const usdValue = Big(currentPrice)
            .mul(newBtcAmount)
            .toFixed(2);

          usdRef.current.value = usdValue;
          setUsdAmount(usdValue);
        }
        } value={[percent]} defaultValue={[0]} max={100} step={1} />
        <span className="w-10 text-right text-xs opacity-80">{percent}%</span>
      </div>
      <div>
        <Text
          className={cn("mb-1 text-sm opacity-80", width < 350 && "text-xs")}
          asChild
        >
          <label htmlFor="input-market-leverage">Leverage (x)</label>
        </Text>
        <Input
          ref={leverageRef}
          onChange={(e) => {
            const value = e.target.value.replace(/[^\d]/, "");

            if (leverageRef.current) {
              if (parseInt(value) > 50) {
                leverageRef.current.value = "50";
                setLeverage("50");
                return;
              }

              if (parseInt(value) < 1) {
                leverageRef.current.value = "1";
                setLeverage("1");
                return;
              }

              leverageRef.current.value = value;
              setLeverage(value);
            }
          }}
          placeholder="1"
          id="input-market-leverage"
        />
      </div>

      <Slider onValueChange={(value) => {
        if (!leverageRef.current) return;
        leverageRef.current.value = value[0].toString();
        setLeverage(value[0].toString());
      }
      } value={[parseInt(leverage)]} defaultValue={[1]} max={50} step={1} />
      <div className="flex justify-between">
        <Text
          className={"mb-1 opacity-80 text-xs"}
        >
          Position Size (USD)
        </Text>
        <Text
          className={"mb-1 opacity-80 text-xs"}
        >
          ${positionSize}
        </Text>
      </div>
      <ExchangeResource>
        <div
          className={cn(
            "flex justify-between",
            width < 350 ? "flex-col space-y-2" : "flex-row space-x-4"
          )}
        >
          <Button
            onClick={() => submitMarket("BUY")}
            id="btn-market-buy"
            className="border-green-medium py-2 text-green-medium opacity-70 transition-opacity hover:border-green-medium hover:text-green-medium hover:opacity-100 disabled:opacity-40 disabled:hover:border-green-medium disabled:hover:opacity-40"
            variant="ui"
            disabled={isSubmitting || status === WalletStatus.Disconnected}
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin text-primary opacity-60" />
            ) : (
              "Buy"
            )}
          </Button>
          <Button
            onClick={() => submitMarket("SELL")}
            id="btn-market-sell"
            variant="ui"
            className="border-red py-2 text-red opacity-70 transition-opacity hover:border-red hover:text-red hover:opacity-100 disabled:opacity-40 disabled:hover:border-red disabled:hover:opacity-40"
            disabled={isSubmitting || status === WalletStatus.Disconnected}
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin text-primary opacity-60" />
            ) : (
              "Sell"
            )}
          </Button>
          {/* <Button
            onClick={() => {
              toast({
                title: "Success",
                description: (
                  <div className="flex items-center space-x-1 opacity-90">
                    <span>Successfully submitted trade order.</span>
                    <Button
                      variant="link"
                      className="inline-flex text-sm opacity-90 hover:opacity-100"
                      asChild
                    >
                      <Link
                        href={`${process.env.NEXT_PUBLIC_EXPLORER_URL as string}/tx/BRCs50fMzA3AW7q0HuzkA`}
                        target={"_blank"}
                      >
                        Explorer link
                      </Link>
                    </Button>
                  </div>
                ),
              });

              addTradeHistory({
                accountAddress: currentZkAccount.address,
                orderStatus: "FILLED",
                orderType: "MARKET",
                tx_hash: "BRCs50fMzA3AW7q0HuzkA",
                uuid: "BRCs50fMzA3AW7q0Hu_zkA",
                value: 100,
                output: "",
                positionType: "LONG",
                date: new Date(),
              });
            }}
          >
            Test
          </Button> */}
        </div>
      </ExchangeResource>
    </form>
  );
};

export default OrderMarketForm;
