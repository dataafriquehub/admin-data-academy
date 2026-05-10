import { Suspense } from "react";
import MessagingScreen from "./messaging-screen";

export default function MessagingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[60vh] items-center justify-center text-small text-neutral-6">
          Chargement de la messagerie…
        </div>
      }
    >
      <MessagingScreen />
    </Suspense>
  );
}
