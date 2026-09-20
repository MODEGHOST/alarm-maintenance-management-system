"use client";

import { Button, Card, DatePicker, Input, Select, Space } from "antd";
import {
  ClearOutlined,
  DownloadOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import type { AdvancedFilterState } from "@/lib/filters";
import { emptyAdvancedFilter } from "@/lib/filters";

type Option = { value: string; label: string };

type Props = {
  value: AdvancedFilterState;
  onChange: (next: AdvancedFilterState) => void;
  statusOptions?: Option[];
  machineOptions?: Option[];
  typeOptions?: Option[];
  locationOptions?: Option[];
  showType?: boolean;
  showLocation?: boolean;
  keywordPlaceholder?: string;
  onExport?: () => void;
  exportLabel?: string;
};

export function AdvancedFilterBar({
  value,
  onChange,
  statusOptions = [],
  machineOptions = [],
  typeOptions = [],
  locationOptions = [],
  showType = false,
  showLocation = false,
  keywordPlaceholder = "ค้นหา...",
  onExport,
  exportLabel = "Export CSV/Excel",
}: Props) {
  function patch(partial: Partial<AdvancedFilterState>) {
    onChange({ ...value, ...partial });
  }

  function onRange(
    dates: [Dayjs | null, Dayjs | null] | null,
  ) {
    patch({
      dateFrom: dates?.[0] ? dates[0].startOf("day").toISOString() : "",
      dateTo: dates?.[1] ? dates[1].endOf("day").toISOString() : "",
    });
  }

  return (
    <Card size="small" className="ui-card filter-card">
      <div className="filter-bar">
        <div className="filter-bar-title">
          <FilterOutlined />
          <span>ตัวกรองขั้นสูง</span>
        </div>
        <Space wrap size={[12, 12]} style={{ width: "100%" }}>
          <Input
            allowClear
            style={{ minWidth: 200 }}
            placeholder={keywordPlaceholder}
            value={value.keyword}
            onChange={(e) => patch({ keyword: e.target.value })}
          />
          {statusOptions.length > 0 && (
            <Select
              allowClear
              placeholder="สถานะ"
              style={{ minWidth: 150 }}
              value={value.status || undefined}
              options={statusOptions}
              onChange={(v) => patch({ status: v || "" })}
            />
          )}
          {machineOptions.length > 0 && (
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="เครื่องจักร"
              style={{ minWidth: 180 }}
              value={value.machineId || undefined}
              options={machineOptions}
              onChange={(v) => patch({ machineId: v || "" })}
            />
          )}
          {showType && typeOptions.length > 0 && (
            <Select
              allowClear
              placeholder="ประเภท"
              style={{ minWidth: 140 }}
              value={value.type || undefined}
              options={typeOptions}
              onChange={(v) => patch({ type: v || "" })}
            />
          )}
          {showLocation && locationOptions.length > 0 && (
            <Select
              allowClear
              placeholder="ตำแหน่ง"
              style={{ minWidth: 140 }}
              value={value.location || undefined}
              options={locationOptions}
              onChange={(v) => patch({ location: v || "" })}
            />
          )}
          <DatePicker.RangePicker
            allowClear
            format="DD/MM/YYYY"
            placeholder={["จากวันที่", "ถึงวันที่"]}
            value={
              value.dateFrom && value.dateTo
                ? [dayjs(value.dateFrom), dayjs(value.dateTo)]
                : null
            }
            onChange={onRange}
          />
          <Button
            icon={<ClearOutlined />}
            onClick={() => onChange({ ...emptyAdvancedFilter })}
          >
            ล้างตัวกรอง
          </Button>
          {onExport && (
            <Button type="primary" icon={<DownloadOutlined />} onClick={onExport}>
              {exportLabel}
            </Button>
          )}
        </Space>
      </div>
    </Card>
  );
}
