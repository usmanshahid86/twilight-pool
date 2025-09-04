import { SelfApp, SelfAppBuilder, SelfQRcodeWrapper } from '@selfxyz/qrcode';
import { getUniversalLink } from "@selfxyz/core";
import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/button';
import { v4 as uuidv4 } from 'uuid';


const BACKEND_URL = "https://zk-kyc.twilight.rest/";

export default function SelfQRComponent({
  walletAddress,
  signature,
}: {
  walletAddress: string;
  signature: string;
}) {
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [universalLink, setUniversalLink] = useState("");
  const [userId] = useState(uuidv4());

  useEffect(() => {
    try {
      const app = new SelfAppBuilder({
        version: 2,
        appName: "Twilight Self Passport",
        scope: "twilight-relayer-passport",
        endpoint: `${BACKEND_URL}/api/verify`,
        logoBase64: "https://staging-frontend.twilight.rest/images/twilight.png",
        userId: userId,
        userIdType: "uuid",
        endpointType: "staging_https",
        userDefinedData: walletAddress,
        disclosures: {
          ofac: false,
          excludedCountries: ['IRN', 'PRK', 'CUB', 'SYR'],

          nationality: false,
          gender: false,
          date_of_birth: false,
          passport_number: false,
          expiry_date: true,
          issuing_state: true,
          name: false,
        },
        devMode: true,
      }).build();

      setSelfApp(app);
      setUniversalLink(getUniversalLink(app));

    } catch (error) {
      console.error("Failed to initialize Self app:", error);
    }
  }, [walletAddress]);


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