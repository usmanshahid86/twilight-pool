"use client";
import cn from "@/lib/cn";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import Big from "big.js";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-primary-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

interface NumberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  inputValue: number;
  setInputValue: (val: number) => void;
  currentPrice: number;
  step?: number;
  minValue?: number;
  maxValue?: number;
}

const NumberInput = ({
  className,
  step = 1,
  defaultValue,
  minValue = 0,
  maxValue = Number.MAX_SAFE_INTEGER,
  inputValue,
  setInputValue,
  currentPrice,
  ...props
}: NumberInputProps) => {
  const id = useId();

  const inputRef = useCallback(
    (node: HTMLInputElement) => {
      if (node === null) return null;

      node.value = inputValue.toString();
      return node;
    },
    [inputValue]
  );

  return (
    <div className="relative flex w-full">
      <Input
        id={id}
        defaultValue={defaultValue || 0}
        type="number"
        className={className}
        ref={inputRef}
        onKeyDown={(e) => {
          // Prevent negative sign and multiple dots
          if (e.key === '-' || e.key === 'e' || e.key === 'E') {
            e.preventDefault();
          }
          // Prevent multiple dots
          if (e.key === '.' && e.currentTarget.value.includes('.')) {
            e.preventDefault();
          }
        }}
        onChange={(e) => {
          // Remove any negative signs and ensure only one dot
          let value = e.target.value.replace(/-/g, '');
          const dotCount = (value.match(/\./g) || []).length;
          if (dotCount > 1) {
            // Keep only the first dot
            const firstDotIndex = value.indexOf('.');
            value = value.slice(0, firstDotIndex + 1) + value.slice(firstDotIndex + 1).replace(/\./g, '');
          }
          e.target.value = value;

          props.onChange?.(e);
          setInputValue(Big(value || 0).toNumber())
        }}
        {...props}
      />
      <div className="text-sm absolute inset-y-0 right-2 mt-[1px] flex h-[calc(100%-2px)] flex-col items-center justify-center hover:text-theme transition-colors">
        <button onClick={() => setInputValue(currentPrice)}>Mid</button>
      </div>
    </div>
  );
};

NumberInput.displayName = "Input";

interface PopoverInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  options: string[];
  onClickPopover: React.MouseEventHandler<HTMLButtonElement>;
  selected: string;
  setSelected: React.Dispatch<React.SetStateAction<string>>;
}

const PopoverInput = React.forwardRef<HTMLInputElement, PopoverInputProps>(
  (
    { className, options, selected, setSelected, onClickPopover, ...props },
    ref
  ) => {
    const [popoverOpen, setPopoverOpen] = useState(false);

    const [popoverOpenState, setPopoverOpenState] = useState("closed");
    const popoverRefCallback = useCallback((node: HTMLButtonElement) => {
      if (node !== null) {
        setPopoverOpenState(node.dataset.state || "closed");
      }
    }, []);

    return (
      <div className="relative">
        <Input autoComplete="off" ref={ref} {...props} className={className} />

        <div className="absolute inset-y-0 right-0 mt-[1px] flex h-[calc(100%-2px)] flex-col items-center justify-center border-l">
          <Popover
            defaultOpen={false}
            open={popoverOpen}
            onOpenChange={setPopoverOpen}
          >
            <PopoverTrigger asChild>
              <button
                ref={popoverRefCallback}
                className="z-10 flex h-full items-center justify-center px-1.5 font-ui text-xs text-primary opacity-60 data-[state=open]:opacity-90"
              >
                <p>{selected}</p>{" "}
                <ChevronDown
                  data-state={popoverOpenState}
                  className="h-[12px] w-[12px] rotate-0 transition-all data-[state=open]:rotate-180"
                />
              </button>
            </PopoverTrigger>
            <PopoverContent
              sideOffset={4}
              side={"bottom"}
              align={"end"}
              className="flex w-full flex-col items-start justify-start rounded-md px-0.5 py-1 font-ui text-xs text-primary"
            >
              {options.map((option, index) => (
                <button
                  className={cn(
                    option === selected ? "hidden" : "",
                    "w-full rounded-md px-1 py-1 text-start hover:bg-primary hover:text-background"
                  )}
                  key={index}
                  value={option}
                  onClick={(e) => {
                    onClickPopover(e);
                    setSelected(option);
                    setPopoverOpen(false);
                  }}
                >
                  {option}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    );
  }
);

PopoverInput.displayName = "Input";

export { Input, NumberInput, PopoverInput };
