import { useTwilightStore } from '@/lib/providers/store';
import React, { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from './dialog';
import { Input } from './input';
import Button from './button';
import { useToast } from '@/lib/hooks/useToast';
import { settleOrder } from '@/lib/zk/trade';
import { useSessionStore } from '@/lib/providers/session';
import Link from 'next/link';
import Big from 'big.js';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';

type Props = {
  account?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SettleLimitDialog({ account, open, onOpenChange }: Props) {
  const usdRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const trades = useTwilightStore((state) => state.trade.trades);
  const updateTrade = useTwilightStore((state) => state.trade.updateTrade)
  const privateKey = useSessionStore((state) => state.privateKey);

  const selectedTrade = trades.find((trade) => trade.accountAddress === account);

  const queryClient = useQueryClient();

  async function handleSettleLimit() {
    const limitPrice = parseFloat(usdRef.current?.value || "0");

    if (isNaN(limitPrice)) {
      toast({
        title: "Invalid limit price",
        description: "Please enter a valid limit price",
        variant: "error",
      });
      return;
    }

    if (limitPrice < 0) {
      toast({
        title: "Invalid limit price",
        description: "Please enter a valid limit price",
        variant: "error",
      });
      return;
    }

    if (!selectedTrade) {
      toast({
        title: "Invalid trade",
        description: "Please select a valid trade",
        variant: "error",
      });
      return;
    }

    onOpenChange(false);

    toast({
      title: "Closing position",
      description: "Please do not close this page while your position is being closed...",
    })

    console.log("limitPrice", limitPrice)
    const result = await settleOrder(selectedTrade, "limit", privateKey, limitPrice)

    if (!result.success) {
      toast({
        title: "Error settling order",
        description: result.message,
        variant: "error",
      })
      return;
    }

    const settledData = result.data;

    updateTrade({
      ...selectedTrade,
      orderStatus: settledData.order_status,
      availableMargin: Big(settledData.available_margin).toNumber(),
      maintenanceMargin: Big(settledData.maintenance_margin).toNumber(),
      unrealizedPnl: Big(settledData.unrealized_pnl).toNumber(),
      settlementPrice: Big(settledData.settlement_price).toNumber(),
      positionSize: Big(settledData.positionsize).toNumber(),
      orderType: settledData.order_type,
      date: dayjs(settledData.timestamp).toDate(),
      exit_nonce: settledData.exit_nonce,
      executionPrice: Big(settledData.execution_price).toNumber(),
      isOpen: false,
      feeSettled: Big(settledData.fee_settled).toNumber(),
      feeFilled: Big(settledData.fee_filled).toNumber(),
      realizedPnl: Big(settledData.unrealized_pnl).toNumber(),
      tx_hash: settledData.tx_hash || selectedTrade.tx_hash,
      liquidationPrice: Big(settledData.liquidation_price).toNumber(),
      bankruptcyPrice: Big(settledData.bankruptcy_price).toNumber(),
      bankruptcyValue: Big(settledData.bankruptcy_value).toNumber(),
      initialMargin: Big(settledData.initial_margin).toNumber(),
    })

    await queryClient.invalidateQueries({ queryKey: ['sync-trades'] })

    toast({
      title: "Limit order sent",
      description: <div className="opacity-90">
        Close position limit order sent.{" "}
        {
          settledData.tx_hash && (
            <Link
              href={`https://explorer.twilight.rest/nyks/tx/${settledData.tx_hash}`}
              target={"_blank"}
              className="text-sm underline hover:opacity-100"
            >
              Explorer link
            </Link>
          )
        }
      </div>
    })

  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Settle Limit</DialogTitle>
        <div className="flex flex-col gap-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-primary-accent" htmlFor="input-limit-amount-usd">Limit Price (USD)</label>
            <Input
              type="text"
              id="input-limit-amount-usd"
              placeholder="0.00"
              ref={usdRef}
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

                // Limit to 2 decimal places (USD precision)
                const decimalIndex = value.indexOf('.');
                if (decimalIndex !== -1 && value.substring(decimalIndex + 1).length > 2) {
                  value = value.substring(0, decimalIndex + 3);
                }

                // Prevent leading zeros except for decimal values
                if (value.length > 1 && value[0] === '0' && value[1] !== '.') {
                  value = value.substring(1);
                }

                // Update the input field value
                e.currentTarget.value = value;
              }}
            />
          </div>

          <Button onClick={handleSettleLimit}>Settle Limit</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SettleLimitDialog
