// lib/debug/mint-burn-test.ts
import { twilightproject } from "twilightjs";
import Long from "long";

export async function testMintBurnTransaction({
  btcValue,
  encryptScalar,
  mintOrBurn,
  qqAccount,
  twilightAddress,
  stargateClient,
  broadcast = false, // New parameter
}: {
  btcValue: number;
  encryptScalar: string;
  mintOrBurn: boolean;
  qqAccount: string;
  twilightAddress: string;
  stargateClient: any;
  broadcast?: boolean; // New parameter
}) {
  const { mintBurnTradingBtc } =
    twilightproject.nyks.zkos.MessageComposer.withTypeUrl;

  console.log("=== Testing mintBurnTradingBtc ===");
  console.log("Mode:", broadcast ? "BROADCAST" : "SIMULATION");
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

    if (broadcast) {
      // Actually broadcast the transaction
      try {
        console.log("📡 Broadcasting transaction to chain...");
        const broadcastResult = await stargateClient.signAndBroadcast(
          twilightAddress,
          [mintBurnMsg],
          "auto"
        );

        console.log("✅ Transaction broadcast successful:", broadcastResult);
        console.log("Transaction Hash:", broadcastResult.transactionHash);
        console.log("Gas Used:", broadcastResult.gasUsed?.toString());
        console.log("Height:", broadcastResult.height);

        return {
          success: true,
          message: mintBurnMsg,
          transactionHash: broadcastResult.transactionHash,
          gasUsed: broadcastResult.gasUsed?.toString(),
          height: broadcastResult.height,
          rawResponse: broadcastResult,
        };
      } catch (error: any) {
        console.error("❌ Broadcast failed:", error);
        console.error("Error details:", {
          message: error?.message,
          code: error?.code,
          txHash: error?.txHash,
          raw: error,
        });
        return {
          success: false,
          error: {
            message: error?.message,
            code: error?.code,
            txHash: error?.txHash,
            raw: error?.toString(),
          },
          message: mintBurnMsg,
        };
      }
    } else {
      // Test simulation (dry run)
      try {
        const simulationResult = await stargateClient.simulate(
          twilightAddress,
          [mintBurnMsg]
        );
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
