import Button from "@/components/button";
import ExchangeResource from "@/components/exchange-resource";
import { Input, NumberInput } from "@/components/input";
import { Text } from "@/components/typography";
import { sendTradeOrder } from "@/lib/api/client";
import { queryTradeOrder } from '@/lib/api/relayer';
import { TransactionHash, queryTransactionHashByRequestId, queryTransactionHashes } from "@/lib/api/rest";
import cn from "@/lib/cn";
import { retry } from '@/lib/helpers';
import { useToast } from "@/lib/hooks/useToast";
import { usePriceFeed } from "@/lib/providers/feed";
import { useGrid } from "@/lib/providers/grid";
import { useSessionStore } from "@/lib/providers/session";
import { useTwilightStore } from "@/lib/providers/store";
import { useTwilight } from "@/lib/providers/twilight";
import BTC from "@/lib/twilight/denoms";
import { createZkOrder } from "@/lib/twilight/zk";
import { createQueryTradeOrderMsg } from '@/lib/twilight/zkos';
import { WalletStatus } from "@cosmos-kit/core";
import { useWallet } from "@cosmos-kit/react-lite";
import Big from "big.js";
import dayjs from 'dayjs';
import { Loader2 } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

const OrderMarketForm = () => {
  const { width } = useGrid();

  const privateKey = useSessionStore((state) => state.privateKey);

  const { hasRegisteredBTC } = useTwilight();
  const { getCurrentPrice } = usePriceFeed();
  const currentPrice = getCurrentPrice()

  const { toast } = useToast();

  const { status } = useWallet();

  const btcRef = useRef<HTMLInputElement>(null);
  const usdRef = useRef<HTMLInputElement>(null);
  const leverageRef = useRef<HTMLInputElement>(null);

  const zKAccounts = useTwilightStore((state) => state.zk.zkAccounts);
  const selectedZkAccount = useTwilightStore(
    (state) => state.zk.selectedZkAccount
  );

  const addTrade = useTwilightStore((state) => state.trade.addTrade);
  const updateZkAccount = useTwilightStore((state) => state.zk.updateZkAccount)
  const addTradeHistory = useTwilightStore((state) => state.trade_history.addTrade)

  const currentZkAccount = zKAccounts[selectedZkAccount];

  useEffect(() => {
    if (!currentZkAccount ||
      !currentZkAccount.value ||
      !btcRef.current ||
      !usdRef.current ||
      !leverageRef.current) return;

    const userBtcBalance = new BTC("sats", Big(currentZkAccount.value)).convert("BTC")
    const btcValue = BTC.format(userBtcBalance);

    btcRef.current.value = btcValue;

    // Manually trigger the USD calculation that would happen in onChange
    if (btcValue && Big(btcValue).gt(0)) {
      Big.DP = 2;
      usdRef.current.value = Big(currentPrice)
        .mul(btcValue)
        .toFixed(2);
    } else {
      usdRef.current.value = "";
    }

    leverageRef.current.value = "1";
  }, [selectedZkAccount, currentPrice, currentZkAccount])

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitMarket(type: "SELL" | "BUY") {
    const positionType = type === "BUY" ? "LONG" : "SHORT";

    if (currentZkAccount.type !== "Coin") {
      toast({
        variant: "error",
        title: "Unable to submit trade order",
        description: currentZkAccount.type === "Memo" ?
          "Account is locked for trading, please use a new account to trade" :
          "Account has been used for trading, please transfer funds to a new trading account to trade",
      });
      return;
    }

    try {
      if (!hasRegisteredBTC) return;

      const btcValue = btcRef.current?.value;

      if (!btcValue) {
        toast({
          variant: "error",
          title: "Missing BTC value",
          description: "Please enter a valid value",
        });
        return;
      }

      const satsValue = new BTC("BTC", Big(btcValue))
        .convert("sats")
        .toNumber();

      if (!currentZkAccount.value || currentZkAccount.value < satsValue) {
        toast({
          variant: "error",
          title: "Insufficient funds",
          description: "You do not have enough funds to submit this trade order",
        });
        return;
      }

      if (currentZkAccount.value - satsValue !== 0) {
        toast({
          variant: "error",
          title: "Unable to submit trade order",
          description: "You can only enter the full balance of the account to submit a trade order",
        });
        return;
      }

      setIsSubmitting(true);

      const leverage = parseInt(leverageRef.current?.value || "1");

      console.log("lev", leverage);
      // return;
      const { success, msg } = await createZkOrder({
        leverage: leverage,
        orderType: "MARKET",
        positionType,
        signature: privateKey,
        timebounds: 1,
        zkAccount: currentZkAccount,
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

      if (!data.result || !data.result.id_key) {
        toast({
          variant: "error",
          title: "Unable to submit trade order",
          description: "An error has occurred, try again later.",
        });
        setIsSubmitting(false);
        return;
      }

      console.log("sendTradeOrder", data);

      const requestId = data.result.id_key;

      toast({
        title: "Submitting order",
        description: "Order is being submitted...",
      });

      let orderData: TransactionHash | undefined = undefined;

      const queryTransactionRes = await retry<
        ReturnType<typeof queryTransactionHashByRequestId>,
        string
      >(
        queryTransactionHashByRequestId,
        9,
        requestId,
        2500,
        (txHash) => {
          if (!txHash) return false;

          const found = txHash.result.find(
            (tx) => tx.order_status === "FILLED"
          );

          return found ? true : false;
        }
      );

      if (!queryTransactionRes.success || !queryTransactionRes.data) {
        toast({
          variant: "error",
          title: "Error",
          description: "Error with creating trade order",
        });
        setIsSubmitting(false);
        return;
      }

      orderData = queryTransactionRes.data.result[0] as TransactionHash;

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
        address: currentZkAccount.address,
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
        accountAddress: currentZkAccount.address,
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

      updateZkAccount(currentZkAccount.address, {
        ...currentZkAccount,
        type: "Memo",
      });


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
      className="flex flex-col space-y-3 px-3"
    >
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
            readOnly
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
                return;
              }

              Big.DP = 2;

              usdRef.current.value = Big(currentPrice)
                .mul(value)
                .toFixed(2)
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
            readOnly
            onChange={(e) => {
              if (!btcRef.current) return;

              if (
                !e.currentTarget.value ||
                Big(e.currentTarget.value).eq(0) ||
                Big(e.currentTarget.value).lt(0)
              ) {
                btcRef.current.value = "";
                return;
              }
              Big.DP = 8;

              const usdInput = e.currentTarget.value;
              btcRef.current.value = new Big(usdInput)
                .div(currentPrice || 1)
                .toString();
            }}
          />
        </div>
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
          autoComplete="off"
          onChange={(e) => {
            const value = e.target.value.replace(/[^\d]/, "");

            if (leverageRef.current) {
              if (parseInt(value) > 50) {
                leverageRef.current.value = "50";
                return;
              }

              if (parseInt(value) < 1) {
                leverageRef.current.value = "1";
                return;
              }

              leverageRef.current.value = value;
            }
          }}
          placeholder="1"
          id="input-market-leverage"
        />
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
