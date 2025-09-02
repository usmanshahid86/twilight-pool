"use client";

import React from "react";
import cn from "@/lib/cn";

export interface StepperProps {
  steps: Array<{
    id: string;
    label: string;
  }>;
  currentStep: number;
  className?: string;
  connectorWidth?: string | string[];
}

const Stepper = React.forwardRef<HTMLDivElement, StepperProps>(
  ({ steps, currentStep, className, connectorWidth = "w-16" }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-center space-x-4", className)}
      >
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          const isUpcoming = stepNumber > currentStep;

          // Get connector width for this specific connector
          const getConnectorWidth = () => {
            if (Array.isArray(connectorWidth)) {
              return connectorWidth[index] || "w-16";
            }
            return connectorWidth;
          };

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center space-y-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-all duration-300",
                    {
                      "border-theme bg-theme text-white": isActive || isCompleted,
                      "border-gray-300 bg-background text-gray-400": isUpcoming,
                    }
                  )}
                >
                  {stepNumber}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium transition-colors duration-300",
                    {
                      "text-theme": isActive || isCompleted,
                      "text-gray-400": isUpcoming,
                    }
                  )}
                >
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 transition-colors duration-300",
                    getConnectorWidth(),
                    {
                      "bg-theme": stepNumber < currentStep,
                      "bg-gray-300": stepNumber >= currentStep,
                    }
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }
);

Stepper.displayName = "Stepper";

export default Stepper;
