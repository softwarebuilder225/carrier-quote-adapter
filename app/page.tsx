import { QuoteFlow } from "@/components/QuoteFlow";
import { getCarrier } from "@/lib/carriers";

const CARRIER_ID = "harbor";

export default function Home() {
  const carrier = getCarrier(CARRIER_ID);
  return (
    <main className="page">
      <header className="page-header">
        <h1>
          {carrier.name} {carrier.form.product} quote
        </h1>
        <p className="muted">We pre-fill what your profile already answers and ask only for the rest.</p>
      </header>
      <QuoteFlow carrierId={CARRIER_ID} />
    </main>
  );
}
