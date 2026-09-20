"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import thTH from "antd/locale/th_TH";
import dayjs from "dayjs";
import "dayjs/locale/th";

dayjs.locale("th");

export function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider
        locale={thTH}
        theme={{
          token: {
            colorPrimary: "#0c4a6e",
            colorInfo: "#0284c7",
            colorWarning: "#ea580c",
            borderRadius: 10,
            fontFamily: "var(--font-body), sans-serif",
            controlHeightLG: 44,
          },
          components: {
            Button: {
              primaryShadow: "none",
            },
            Input: {
              activeBorderColor: "#0c4a6e",
              hoverBorderColor: "#0284c7",
            },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </AntdRegistry>
  );
}
