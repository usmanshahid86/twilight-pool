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
  const [broadcastMode, setBroadcastMode] = useState(false); // New state

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
        broadcast: broadcastMode, // Pass broadcast mode
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
        {/* Broadcast Mode Toggle */}
        <div className="border-yellow-400 bg-yellow-50 rounded-lg border-2 p-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={broadcastMode}
              onChange={(e) => setBroadcastMode(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="font-semibold">
              {broadcastMode
                ? "⚠️ BROADCAST MODE (Real Transaction)"
                : "Simulation Mode (Dry Run)"}
            </span>
          </label>
          {broadcastMode && (
            <p className="text-red-600 mt-2 text-sm">
              ⚠️ Warning: This will send a real transaction to the chain and may
              cost fees!
            </p>
          )}
        </div>

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

        <Button
          onClick={handleTest}
          disabled={loading}
          className={broadcastMode ? "bg-red-600 hover:bg-red-700" : ""}
        >
          {loading
            ? broadcastMode
              ? "Broadcasting..."
              : "Simulating..."
            : broadcastMode
              ? "🚀 Broadcast Transaction"
              : "Test Transaction (Simulation)"}
        </Button>

        {result && (
          <div
            className={`rounded p-4 ${result.success ? "bg-green-100" : "bg-red-100"}`}
          >
            <Text heading="h3">
              {result.success ? "✅ Success" : "❌ Error"}
            </Text>

            {result.success && result.transactionHash && (
              <div className="bg-blue-50 mt-2 rounded p-3">
                <p className="font-semibold">Transaction Hash:</p>
                <code className="font-mono break-all text-sm">
                  {result.transactionHash}
                </code>
                {result.gasUsed && (
                  <p className="mt-1 text-sm">Gas Used: {result.gasUsed}</p>
                )}
                {result.height && (
                  <p className="text-sm">Block Height: {result.height}</p>
                )}
              </div>
            )}

            {!result.success && result.error && (
              <div className="bg-red-50 mt-2 rounded p-3">
                <p className="text-red-800 font-semibold">Error Details:</p>
                <p className="text-red-700 text-sm">
                  {result.error.message || result.error}
                </p>
                {result.error.code && (
                  <p className="text-red-600 text-sm">
                    Code: {result.error.code}
                  </p>
                )}
                {result.error.txHash && (
                  <p className="text-red-600 text-sm">
                    Tx Hash: {result.error.txHash}
                  </p>
                )}
              </div>
            )}

            <pre className="mt-2 overflow-auto text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
