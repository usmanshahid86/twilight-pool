// app/(main)/test-mint-burn/page.tsx
"use client";

import { useState } from "react";
import { useWallet } from "@cosmos-kit/react-lite";
import { testMintBurnTransaction } from "../../../lib/debug/mint-burn-test";
import Button from "@/components/button";
import { Text } from "@/components/typography";

export default function TestMintBurnPage() {
  const { mainWallet } = useWallet();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [formData, setFormData] = useState({
    btcValue: "1000",
    encryptScalar: "",
    mintOrBurn: false,
    qqAccount: "",
    twilightAddress: "",
  });

  const handleTest = async () => {
    setLoading(true);
    setResult(null);

    try {
      const chainWallet = mainWallet?.getChainWallet("nyks");
      if (!chainWallet) {
        setResult({ success: false, error: "Wallet not connected" });
        return;
      }

      const stargateClient = await chainWallet.getSigningStargateClient();
      const address = chainWallet.address || formData.twilightAddress;

      const testResult = await testMintBurnTransaction({
        btcValue: Number(formData.btcValue),
        encryptScalar: formData.encryptScalar,
        mintOrBurn: formData.mintOrBurn,
        qqAccount: formData.qqAccount,
        twilightAddress: address,
        stargateClient,
      });

      setResult(testResult);
    } catch (error) {
      setResult({ success: false, error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl p-8">
      <Text heading="h1">Test mintBurnTradingBtc Transaction</Text>

      <div className="mt-8 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">
            BTC Value (sats)
          </label>
          <input
            type="number"
            value={formData.btcValue}
            onChange={(e) =>
              setFormData({ ...formData, btcValue: e.target.value })
            }
            className="w-full rounded border p-2"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Encrypt Scalar
          </label>
          <input
            type="text"
            value={formData.encryptScalar}
            onChange={(e) =>
              setFormData({ ...formData, encryptScalar: e.target.value })
            }
            className="font-mono w-full rounded border p-2 text-sm"
            placeholder="Paste scalar here"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            QQ Account (hex)
          </label>
          <textarea
            value={formData.qqAccount}
            onChange={(e) =>
              setFormData({ ...formData, qqAccount: e.target.value })
            }
            className="font-mono w-full rounded border p-2 text-sm"
            rows={3}
            placeholder="Paste qqAccount hex here"
          />
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.mintOrBurn}
              onChange={(e) =>
                setFormData({ ...formData, mintOrBurn: e.target.checked })
              }
            />
            <span>mintOrBurn (true = mint, false = burn)</span>
          </label>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Twilight Address (optional, uses wallet if empty)
          </label>
          <input
            type="text"
            value={formData.twilightAddress}
            onChange={(e) =>
              setFormData({ ...formData, twilightAddress: e.target.value })
            }
            className="font-mono w-full rounded border p-2 text-sm"
            placeholder="Will use connected wallet address if empty"
          />
        </div>

        <Button onClick={handleTest} disabled={loading}>
          {loading ? "Testing..." : "Test Transaction (Simulation Only)"}
        </Button>

        {result && (
          <div
            className={`rounded p-4 ${result.success ? "bg-green-100" : "bg-red-100"}`}
          >
            <Text heading="h3">Result:</Text>
            <pre className="mt-2 overflow-auto text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
