"use client";

import Button from "@/components/button";
import { Text } from "@/components/typography";
import cn from '@/lib/cn';
import React, { useState } from "react";

type TimePeriod = "1D" | "1W" | "1M" | "6M" | "1Y";

const ApyChart = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1D");

  const timePeriods: TimePeriod[] = ["1D", "1W", "1M", "6M", "1Y"];

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        {timePeriods.map((period) => (
          <Button
            key={period}
            variant={"ui"}
            size="small"
            onClick={() => setSelectedPeriod(period)}
            className={cn("px-4 py-2 hover:border-theme transition-colors", selectedPeriod === period && "border-theme")}
          >
            {period}
          </Button>
        ))}
      </div>

      <div className="h-64 w-full rounded-lg border border-dashed border-primary/20 bg-gradient-to-b from-green-medium/25 to-green-medium/5 flex items-center justify-center">
        <Text className="text-primary/40">
          APY Chart - {selectedPeriod} View
        </Text>
      </div>
    </div>
  );
};

export default ApyChart; 