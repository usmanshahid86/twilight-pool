"use client";

import { useState } from 'react';
import { Text } from '@/components/typography';
import Stepper from '@/components/stepper';
import NextImage from '@/components/next-image';
import Button from '@/components/button';
import cn from '@/lib/cn';
import SelfQRComponent from '@/components/kyc/self-xyz';
import ZKPassportComponent from '@/components/kyc/zk-passport';
import { useWallet } from '@cosmos-kit/react-lite';
import { useSessionStore } from '@/lib/providers/session';
import ConnectWallet from '@/app/_components/layout/connect-wallet.client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/lib/hooks/useToast';

const steps = [
  { id: 'step1', label: 'Step 1' },
  { id: 'step2', label: 'Step 2' },
  { id: 'step3', label: 'Step 3' },
];

const availablePassports = [
  {
    id: "self-xyz",
    name: "Self",
    src: "/images/self-xyz-logo.png",
    disabled: false,
  },
  {
    id: "zk-passport",
    name: "ZK Passport",
    src: "/images/zk-passport-logo.png",
    disabled: true,
  },
] as const;


const Page = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPassport, setSelectedPassport] = useState<"self-xyz" | "zk-passport" | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'completed' | 'error'>('pending');

  const { mainWallet, status } = useWallet();
  const { toast } = useToast();

  const chainWallet = mainWallet?.getChainWallet("nyks");
  const privateKey = useSessionStore((state) => state.privateKey);

  const router = useRouter()

  // Show wallet connection requirement if not connected
  if (status !== "Connected" || !chainWallet || !privateKey) {
    return (
      <div className="mx-4 my-4 space-y-8 md:mx-8">
        <div className="flex w-full flex-col space-y-8">
          <div className="md:space-y-2">
            <Text heading="h1" className="mb-0 text-lg font-normal sm:text-2xl">
              KYC Verification
            </Text>
          </div>
          <div className="w-full max-w-4xl mx-auto flex-col flex items-center space-y-8">
            <div className="flex flex-col items-center space-y-6 p-8 border border-primary/20 bg-primary/5 rounded-lg">
              <div className="text-center space-y-4">
                <Text heading="h2" className="text-xl font-semibold">
                  Wallet Connection Required
                </Text>
                <Text className="text-primary opacity-80 max-w-md">
                  Please connect your wallet to proceed with KYC verification. This is required to verify your identity and access the platform.
                </Text>
              </div>
              <ConnectWallet />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const walletAddress = chainWallet.address as string;

  const handleNextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleVerificationSuccess = () => {
    setVerificationStatus('completed');
    setCurrentStep(3); // Move to completion step
  };

  const handleVerificationError = (error: any) => {
    setVerificationStatus('error');
    console.error('Verification error:', error);
  };

  function renderSteps() {
    switch (currentStep) {
      case 1:
        return <>
          <div className="space-y-2 items-center">
            <Text heading="h2" className="mb-0 text-lg font-normal sm:text-2xl">
              Passport Country Verification Required
            </Text>
            <Text className="text-primary opacity-80">
              To comply with regulatory requirements and ensure the security of our financial services, you must verify the country of issuance of your passport using zero-knowledge proofs before proceeding. This verification step helps us confirm your eligibility and maintain a secure environment for all users.
            </Text>
            <div className="space-y-2 !mt-4">
              <Text className="text-primary text-lg">Choose your Identity Verification Method</Text>
              <div className="flex flex-row w-full justify-between gap-4">
                {
                  availablePassports.map((passport) => (
                    <button
                      onClick={() => {
                        if (passport.disabled) {
                          toast({
                            title: "ZK Passport Unavailable",
                            description: "ZK Passport verification is currently unavailable. Please use Self.xyz verification instead.",
                            variant: "error",
                          });
                          return;
                        }
                        setSelectedPassport(passport.id)
                        handleNextStep()
                      }}
                      key={passport.id}
                      className={cn(
                        "w-1/2 flex flex-col border rounded-md p-1 transition-all duration-300",
                        passport.disabled
                          ? "cursor-not-allowed opacity-50 grayscale"
                          : "cursor-pointer hover:shadow-md"
                      )}
                      disabled={passport.disabled}
                    >
                      <div
                        className={cn(
                          "flex h-full flex-col items-center justify-center rounded-lg py-2 transition-colors duration-300",
                          passport.disabled
                            ? "bg-gray-100 dark:bg-gray-800"
                            : "hover:bg-primary/10"
                        )}
                      >
                        <NextImage
                          className={cn(
                            "p-2",
                            passport.id === "self-xyz" && "dark:bg-primary",
                            passport.disabled && "opacity-50"
                          )}
                          src={passport.src}
                          alt={passport.name}
                          width={100}
                          height={100}
                        />
                        <Text className={cn(
                          "select-none text-2xl font-semibold",
                          passport.disabled && "text-gray-500 dark:text-gray-400"
                        )}>
                          {passport.name}
                        </Text>
                        {passport.disabled && (
                          <Text className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                            Currently Unavailable
                          </Text>
                        )}
                      </div>
                    </button>
                  ))}
              </div>
              <div className="!mt-8 rounded-md border border-primary/20 bg-primary/5 p-4 space-y-3">
                <Text heading="h3" className="mb-2 text-lg">
                  Please note:
                </Text>
                <div className="space-y-2 text-sm">
                  <Text className="text-primary opacity-90">
                    • Only passports issued by supported countries can be verified.
                  </Text>
                  <Text className="text-primary opacity-90">
                    • Your personal data privacy is protected; We use zero-knowledge proofs to verify country information without sharing your full passport details.
                  </Text>
                  <Text className="text-primary opacity-90">
                    • Verification is mandatory to access and use this financial product.
                  </Text>
                  <Text className="text-primary opacity-90">
                    • If you have any questions or need assistance, please contact our support team.
                  </Text>
                </div>
              </div>
            </div>
          </div>

        </>
      case 2:
        return <>
          <div className="space-y-6 items-center">
            <div className="text-center space-y-2">
              <Text heading="h2" className="mb-0 text-lg font-normal sm:text-2xl">
                {selectedPassport === "self-xyz" ? "Self.xyz Passport Verification" : "ZK Passport Verification"}
              </Text>
              <Text className="text-primary opacity-80">
                {selectedPassport === "self-xyz"
                  ? "Scan the QR code below with your Self.xyz app or click the button to open the verification link directly."
                  : "Complete your passport verification using ZK Passport technology."
                }
              </Text>
            </div>

            {selectedPassport === "self-xyz" ? (
              <div className="flex flex-col items-center space-y-6">
                <div className="p-6 border border-primary/20 bg-primary/5 rounded-lg">
                  <SelfQRComponent walletAddress={walletAddress} signature={privateKey} handleSuccess={handleVerificationSuccess} />
                </div>

                <div className="space-y-4 w-full grid grid-cols-2 gap-4 items-start">
                  <div className="col-span-1 h-full flex flex-col">
                    <Text heading="h3" className="text-lg font-semibold">
                      How to complete verification:
                    </Text>
                    <div className="space-y-2 text-sm max-w-md">
                      <Text className="text-primary opacity-90">
                        1. Open the Self.xyz app on your mobile device
                      </Text>
                      <Text className="text-primary opacity-90">
                        2. Scan the QR code above or tap &ldquo;Open Self App&rdquo;
                      </Text>
                      <Text className="text-primary opacity-90">
                        3. Follow the app instructions to verify your passport
                      </Text>
                      <Text className="text-primary opacity-90">
                        4. Wait for verification confirmation
                      </Text>
                    </div>
                  </div>
                  <div className="col-span-1 h-full flex flex-col">
                    <Text heading="h3" className="text-amber-800 dark:text-amber-200 font-semibold">
                      ⚠️ Important Notes:
                    </Text>
                    <div className="space-y-1 text-sm">
                      <Text className="text-amber-700 dark:text-amber-300">
                        • Keep this page open while completing verification
                      </Text>
                      <Text className="text-amber-700 dark:text-amber-300">
                        • Ensure your passport is from a supported country
                      </Text>
                      <Text className="text-amber-700 dark:text-amber-300">
                        • The process may take a few minutes to complete
                      </Text>
                    </div>
                  </div>
                </div>


              </div>
            ) : (
              <div className="flex flex-col items-center space-y-6">
                <div className="p-6 border border-primary/20 bg-primary/5 rounded-lg">
                  <ZKPassportComponent
                    walletAddress={walletAddress}
                    signature={privateKey}
                    onSuccess={handleVerificationSuccess}
                    onError={handleVerificationError}
                  />
                </div>

                <div className="space-y-4 w-full grid grid-cols-2 gap-4 items-start">
                  <div className="col-span-1 h-full flex flex-col">
                    <Text heading="h3" className="text-lg font-semibold">
                      How to complete verification:
                    </Text>
                    <div className="space-y-2 text-sm max-w-md">
                      <Text className="text-primary opacity-90">
                        1. Open the ZK Passport app on your mobile device
                      </Text>
                      <Text className="text-primary opacity-90">
                        2. Scan the QR code above or tap &ldquo;Open ZK Passport App&rdquo;
                      </Text>
                      <Text className="text-primary opacity-90">
                        3. Follow the app instructions to verify your passport
                      </Text>
                      <Text className="text-primary opacity-90">
                        4. Wait for verification confirmation
                      </Text>
                    </div>
                  </div>
                  <div className="col-span-1 h-full flex flex-col">
                    <Text heading="h3" className="text-amber-800 dark:text-amber-200 font-semibold">
                      ⚠️ Important Notes:
                    </Text>
                    <div className="space-y-1 text-sm">
                      <Text className="text-amber-700 dark:text-amber-300">
                        • Keep this page open while completing verification
                      </Text>
                      <Text className="text-amber-700 dark:text-amber-300">
                        • Ensure your passport is from a supported country
                      </Text>
                      <Text className="text-amber-700 dark:text-amber-300">
                        • The process may take a few minutes to complete
                      </Text>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between w-full max-w-md">
              <Button
                onClick={handlePreviousStep}
                variant="secondary"
                size="default"
              >
                Back
              </Button>
            </div>
          </div>
        </>;
      case 3:
        return <>
          <div className="space-y-6 items-center text-center">
            <div className="space-y-4">
              <Text heading="h2" className="mb-0 text-2xl font-normal sm:text-2xl">
                Verification Complete
              </Text>
              <Text className="text-primary opacity-80 max-w-md">
                Your passport has been successfully verified. You can now access all features of the Twilight platform.
              </Text>
            </div>

            <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 p-4 space-y-2">
              <Text heading="h3" className="text-green-800 dark:text-green-200 font-semibold">
                What&apos;s Next?
              </Text>
              <div className="space-y-1 text-sm">
                <Text className="text-green-700 dark:text-green-300">
                  • You can now deposit and trade on the platform
                </Text>
                <Text className="text-green-700 dark:text-green-300">
                  • Access lend and wallet features
                </Text>
                <Text className="text-green-700 dark:text-green-300">
                  • Enjoy full platform functionality
                </Text>
              </div>
            </div>

            <Button
              onClick={() => router.push('/')}
              variant="primary"
              size="default"
            >
              Continue to Platform
            </Button>
          </div>
        </>;
    }
  }

  return (
    <div className="mx-4 my-4 space-y-8 md:mx-8">
      <div className="flex w-full flex-col space-y-8">
        <div className="md:space-y-2">
          <Text heading="h1" className="mb-0 text-lg font-normal sm:text-2xl">
            KYC Verification
          </Text>
        </div>
        <div className="w-full max-w-4xl mx-auto flex-col flex items-center space-y-8">
          <Stepper connectorWidth="w-48" steps={steps} currentStep={currentStep} />
          {renderSteps()}
        </div>
      </div>

    </div>
  );
};

export default Page;