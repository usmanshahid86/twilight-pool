// lib/debug/mint-burn-test.ts
import { twilightproject } from "twilightjs";
import Long from "long";

// lib/debug/mint-burn-test.ts
export async function testMintBurnTransaction({
  btcValue,
  encryptScalar,
  mintOrBurn,
  qqAccount,
  twilightAddress,
  stargateClient,
}: {
  btcValue: number;
  encryptScalar: string;
  mintOrBurn: boolean;
  qqAccount: string;
  twilightAddress: string;
  stargateClient: any;
}) {
  const { mintBurnTradingBtc } =
    twilightproject.nyks.zkos.MessageComposer.withTypeUrl;

  console.log("=== Testing mintBurnTradingBtc ===");
  console.log("Input values:", {
    btcValue,
    encryptScalar,
    mintOrBurn,
    qqAccount,
    twilightAddress,
  });

  try {
    const mintBurnMsg = mintBurnTradingBtc({
      btcValue: Long.fromNumber(btcValue),
      encryptScalar,
      mintOrBurn,
      qqAccount,
      twilightAddress,
    });

    console.log("✅ Message created successfully:", mintBurnMsg);
    console.log("Message typeUrl:", mintBurnMsg.typeUrl);
    console.log("Message value:", mintBurnMsg.value);

    // Test simulation (dry run)
    try {
      const simulationResult = await stargateClient.simulate(twilightAddress, [mintBurnMsg]);
      console.log("✅ Simulation successful:", simulationResult);
      return {
        success: true,
        message: mintBurnMsg,
        simulation: simulationResult,
      };
    } catch (error: any) {
      console.error("❌ Simulation failed:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        txHash: error?.txHash,
      });
      return { success: false, error, message: mintBurnMsg };
    }
  } catch (error) {
    console.error("❌ Message creation failed:", error);
    return { success: false, error };
  }
}

// Make it available globally for console access
if (typeof window !== "undefined") {
  (window as any).testMintBurnTransaction = testMintBurnTransaction;
}
