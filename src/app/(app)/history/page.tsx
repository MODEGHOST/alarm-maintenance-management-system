import { Suspense } from "react";
import HistoryClient from "./HistoryClient";

export default function MachineHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="dash-loading">
          <p>กำลังโหลดประวัติ...</p>
        </div>
      }
    >
      <HistoryClient />
    </Suspense>
  );
}
