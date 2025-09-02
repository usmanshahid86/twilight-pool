import { SelfApp, SelfAppBuilder, SelfQRcodeWrapper } from '@selfxyz/qrcode';
import { getUniversalLink } from "@selfxyz/core";
import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/button';

const BACKEND_URL = "https://twilight-self-backend-production.up.railway.app";

export default function SelfQRComponent({
  walletAddress,
  signature,
}: {
  walletAddress: string;
  signature: string;
}) {
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [universalLink, setUniversalLink] = useState("");

  const walletAddressHex = useMemo(() => {
    return "0x" + Buffer.from(walletAddress, "utf-8").toString('hex')
  }, [walletAddress])

  useEffect(() => {
    try {
      const app = new SelfAppBuilder({
        version: 2,
        appName: "Twilight Self Passport",
        scope: "twilight-relayer-passport",
        endpoint: `${BACKEND_URL}/api/verify`,
        logoBase64: "https://staging-frontend.twilight.rest/images/twilight.png",
        userId: walletAddressHex,
        userIdType: "hex",
        endpointType: "staging_https",
        userDefinedData: signature,
        disclosures: {
          // 1. what you want to verify from users' identity
          // minimumAge: 18,
          ofac: false,
          excludedCountries: ['IRN', 'PRK', 'CUB', 'SYR'],

          // 2. what you want users to reveal (Optional)
          nationality: false,
          gender: false,
          date_of_birth: false,
          passport_number: false,
          expiry_date: true,
          issuing_state: true,
          name: false,
        },
      }).build();

      setSelfApp(app);
      setUniversalLink(getUniversalLink(app));

    } catch (error) {
      console.error("Failed to initialize Self app:", error);
    }
  }, [walletAddressHex, signature]);


  if (!selfApp) return null;

  const handleOpenDeeplink = () => {
    if (universalLink) {
      window.open(universalLink, '_blank');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <SelfQRcodeWrapper
        onSuccess={() => { }}
        onError={() => { }}
        selfApp={selfApp}
      />
      <Button
        onClick={handleOpenDeeplink}
        disabled={!universalLink}
        variant="primary"
        size="default"
      >
        Open Self App
      </Button>
    </div>
  )
}