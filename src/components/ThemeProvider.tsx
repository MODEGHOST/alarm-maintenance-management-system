"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ConfigProvider, theme as antdTheme } from "antd";
import thTH from "antd/locale/th_TH";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import dayjs from "dayjs";
import "dayjs/locale/th";

dayjs.locale("th");

type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  toggle: () => {},
  setMode: () => {},
});

export function useThemeMode() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("am-theme");
    const next =
      saved === "dark" || saved === "light"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setModeState(next);
    document.documentElement.setAttribute("data-theme", next);
    setReady(true);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    window.localStorage.setItem("am-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const isDark = mode === "dark";

  return (
    <ThemeContext.Provider value={{ mode, toggle, setMode }}>
      <AntdRegistry>
        <ConfigProvider
          locale={thTH}
          theme={{
            algorithm: isDark
              ? antdTheme.darkAlgorithm
              : antdTheme.defaultAlgorithm,
            token: {
              colorPrimary: isDark ? "#38bdf8" : "#0c4a6e",
              colorInfo: "#0284c7",
              colorWarning: "#ea580c",
              borderRadius: 10,
              fontFamily: "var(--font-body), sans-serif",
              controlHeightLG: 44,
            },
            components: {
              Button: { primaryShadow: "none" },
            },
          }}
        >
          <div className={ready ? undefined : "theme-booting"}>{children}</div>
        </ConfigProvider>
      </AntdRegistry>
    </ThemeContext.Provider>
  );
}
