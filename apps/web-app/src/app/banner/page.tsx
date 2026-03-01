import { BannerPage } from "@/components/ui/BannerPage";


export default function BannerPageComponent() {
    return (
        <BannerPage
            title="Borrow Assets"
            subtitle="Use your RWA tokens as collateral to borrow USDC or XLM"
            badge="Powered by RWA Lending"
            imageSrc="/banners/borrow.png"
            imageAlt="Borrow illustration"
            actions={<p>Start borrowing</p>}
        />
    );
}