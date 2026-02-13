import Hero from "@/components/home/Hero";
import Problem from "@/components/home/Problem";
import Solution from "@/components/home/Solution";
import Partnership from "@/components/home/Partnership";
import Vision from "@/components/home/Vision";
import Sponsorship from "@/components/home/Sponsorship";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Problem />
      <Solution />
      <Partnership />
      <Vision />
      <Sponsorship />
    </>
  );
}
