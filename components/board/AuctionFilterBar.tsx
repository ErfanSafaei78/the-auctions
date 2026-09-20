"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { TextField } from "@/components/ui/TextField";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import {
  countActiveFilters,
  describeSince,
  isSinceKeyword,
  NO_GROUP,
  type AuctionFilters,
  type DeadlinePreset,
  type TriState,
} from "@/lib/eauc/filters";
import type { SnapshotFacets } from "@/lib/eauc/types";
import { toPersianDigits } from "@/lib/format/digits";
import { formatCount } from "@/lib/format/number";

import { TelegramSubscribeButton } from "./TelegramSubscribeButton";

interface AuctionFilterBarProps {
  filters: AuctionFilters;
  facets: SnapshotFacets;
  onChange: (next: Partial<AuctionFilters>) => void;
  onClear: () => void;
  /** False when TELEGRAM_BOT_TOKEN/TELEGRAM_BOT_USERNAME aren't set. */
  telegramEnabled: boolean;
}

/** Date and optional time back into the single `since` value. */
function joinSince(date: string, time: string) {
  const day = date.trim();
  const clock = time.trim();
  return day && clock ? `${day} ${clock}` : day;
}

export function AuctionFilterBar({
  filters,
  facets,
  onChange,
  onClear,
  telegramEnabled,
}: AuctionFilterBarProps) {
  const activeCount = countActiveFilters(filters);

  // Collapsible because the table is the point. Once filters are set they
  // cost eight rows of vertical space that the data should have — but the
  // chips below stay visible either way, so collapsing never hides *what*
  // is filtered, only the controls.
  const [open, setOpen] = useState(true);

  // "custom" is a UI mode, not a stored value — the filter itself is just a
  // string. Kept in state so choosing "تاریخ دلخواه" leaves the input on
  // screen while it is still empty and nothing is filtered yet.
  const [customSince, setCustomSince] = useState(
    () => Boolean(filters.since) && !isSinceKeyword(filters.since),
  );

  const sinceMode =
    filters.since && isSinceKeyword(filters.since)
      ? filters.since
      : customSince || filters.since
        ? "custom"
        : "all";

  // The one `since` string is edited as two fields; the time is optional.
  const [sinceDate = "", sinceTime = ""] = filters.since.trim().split(/\s+/);

  const groupOptions = useMemo(
    () => [
      ...facets.goodsGroups.map((group) => ({ value: group, label: group })),
      { value: NO_GROUP, label: "بدون گروه" },
    ],
    [facets.goodsGroups],
  );

  const provinceOptions = useMemo(
    () =>
      facets.lotProvinces.map((province) => ({
        value: province,
        label: province,
      })),
    [facets.lotProvinces],
  );

  // Cities narrow to the chosen provinces; otherwise every city is offered.
  const cityOptions = useMemo(() => {
    const source =
      filters.lotProvinces.length > 0
        ? filters.lotProvinces
        : Object.keys(facets.citiesByProvince);

    const cities = new Set<string>();
    for (const province of source) {
      for (const city of facets.citiesByProvince[province] ?? []) {
        cities.add(city);
      }
    }

    return [...cities]
      .sort(new Intl.Collator("fa").compare)
      .map((city) => ({ value: city, label: city }));
  }, [facets.citiesByProvince, filters.lotProvinces]);

  // One chip per active filter, in form order, so a collapsed panel still
  // shows everything that is narrowing the board.
  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  if (filters.auctionNo) {
    chips.push({
      key: "auctionNo",
      label: `مزایده ${toPersianDigits(filters.auctionNo)}`,
      onRemove: () => onChange({ auctionNo: "" }),
    });
  }
  if (filters.lotNo) {
    chips.push({
      key: "lotNo",
      label: `پارتی ${toPersianDigits(filters.lotNo)}`,
      onRemove: () => onChange({ lotNo: "" }),
    });
  }

  for (const group of filters.goodsGroups) {
    chips.push({
      key: `group:${group}`,
      label: group === NO_GROUP ? "بدون گروه" : group,
      onRemove: () =>
        onChange({
          goodsGroups: filters.goodsGroups.filter((item) => item !== group),
        }),
    });
  }
  for (const province of filters.lotProvinces) {
    chips.push({
      key: `province:${province}`,
      label: province,
      onRemove: () =>
        onChange({
          lotProvinces: filters.lotProvinces.filter((item) => item !== province),
        }),
    });
  }
  for (const city of filters.lotCities) {
    chips.push({
      key: `city:${city}`,
      label: city,
      onRemove: () =>
        onChange({
          lotCities: filters.lotCities.filter((item) => item !== city),
        }),
    });
  }
  if (filters.hasReservePrice !== "any") {
    chips.push({
      key: "price",
      label:
        filters.hasReservePrice === "yes" ? "قیمت پایه دارد" : "بدون قیمت پایه",
      onRemove: () => onChange({ hasReservePrice: "any" }),
    });
  }
  if (filters.deadlinePreset !== "all") {
    chips.push({
      key: "deadline",
      label:
        filters.deadlinePreset === "open" ? "مهلت در جریان" : "مهلت تا ۷ روز",
      onRemove: () => onChange({ deadlinePreset: "all" }),
    });
  }
  if (filters.since) {
    chips.push({
      key: "since",
      label: `جدید از ${describeSince(filters.since)}`,
      onRemove: () => {
        setCustomSince(false);
        onChange({ since: "" });
      },
    });
  }
  if (filters.deadlineFrom || filters.deadlineTo) {
    const range = [
      filters.deadlineFrom ? `از ${filters.deadlineFrom}` : "",
      filters.deadlineTo ? `تا ${filters.deadlineTo}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    chips.push({
      key: "deadlineRange",
      label: `مهلت ${toPersianDigits(range)}`,
      onRemove: () => onChange({ deadlineFrom: "", deadlineTo: "" }),
    });
  }

  return (
    <section
      aria-label="فیلترها"
      className="rounded-xl border border-line bg-surface p-4 shadow-panel"
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className="flex items-center gap-2 text-sm font-semibold text-fg transition-colors hover:text-accent"
        >
          <SlidersHorizontal className="size-4" />
          فیلترها
          {activeCount > 0 ? (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
              {formatCount(activeCount)} فعال
            </span>
          ) : null}
        </button>

        <div className="flex items-center gap-1">
          {telegramEnabled ? <TelegramSubscribeButton filters={filters} /> : null}
          {activeCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setCustomSince(false);
                onClear();
              }}
            >
              پاک کردن همه
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? "بستن" : "نمایش"}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            label="شماره مزایده"
            placeholder="مثلاً ۱۰۰۵۰۰۱"
            value={filters.auctionNo}
            onValueChange={(value) => onChange({ auctionNo: value })}
            inputMode="numeric"
          />

          <TextField
            label="شماره پارتی"
            placeholder="مثلاً ۱۱۰۵۰۰۱"
            value={filters.lotNo}
            onValueChange={(value) => onChange({ lotNo: value })}
            inputMode="numeric"
          />

          <MultiSelect
            label="گروه کالا"
            placeholder="همه گروه‌ها"
            options={groupOptions}
            selected={filters.goodsGroups}
            onSelectedChange={(next) => onChange({ goodsGroups: next })}
            searchable
          />

          <MultiSelect
            label="استان پارتی"
            placeholder="همه استان‌ها"
            options={provinceOptions}
            selected={filters.lotProvinces}
            onSelectedChange={(next) =>
              // Dropping a province must not strand its cities in the filter.
              onChange({
                lotProvinces: next,
                lotCities:
                  next.length === 0
                    ? filters.lotCities
                    : filters.lotCities.filter((city) =>
                        next.some((province) =>
                          (facets.citiesByProvince[province] ?? []).includes(
                            city,
                          ),
                        ),
                      ),
              })
            }
            searchable
          />

          <MultiSelect
            label="شهر پارتی"
            placeholder="همه شهرها"
            options={cityOptions}
            selected={filters.lotCities}
            onSelectedChange={(next) => onChange({ lotCities: next })}
            searchable
          />

          <ToggleGroup<TriState>
            label="قیمت پایه"
            value={filters.hasReservePrice}
            onValueChange={(value) => onChange({ hasReservePrice: value })}
            options={[
              { value: "any", label: "همه" },
              { value: "yes", label: "دارد" },
              { value: "no", label: "ندارد" },
            ]}
          />

          <ToggleGroup<DeadlinePreset>
            label="مهلت ارسال پیشنهاد"
            value={filters.deadlinePreset}
            onValueChange={(value) => onChange({ deadlinePreset: value })}
            options={[
              { value: "all", label: "همه" },
              { value: "open", label: "در جریان" },
              { value: "soon", label: "تا ۷ روز" },
            ]}
          />

          <div className="grid grid-cols-2 gap-2">
            <TextField
              label="مهلت از"
              placeholder="۱۴۰۵/۰۷/۱۴"
              value={filters.deadlineFrom}
              onValueChange={(value) => onChange({ deadlineFrom: value })}
              inputMode="numeric"
            />
            <TextField
              label="مهلت تا"
              placeholder="۱۴۰۵/۰۷/۲۱"
              value={filters.deadlineTo}
              onValueChange={(value) => onChange({ deadlineTo: value })}
              inputMode="numeric"
            />
          </div>
          <ToggleGroup<typeof sinceMode>
            label="تازه‌ها"
            value={sinceMode}
            onValueChange={(value) => {
              setCustomSince(value === "custom");
              onChange({ since: value === "all" || value === "custom" ? "" : value });
            }}
            options={[
              { value: "all", label: "همه" },
              { value: "today", label: "از امروز" },
              { value: "yesterday", label: "از دیروز" },
              { value: "3d", label: "از ۳ روز پیش" },
              { value: "7d", label: "از یک هفته پیش" },
              { value: "custom", label: "از تاریخ" },
            ]}
          />

          {sinceMode === "custom" ? (
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-2">
                <TextField
                  label="جدید از تاریخ"
                  placeholder="۱۴۰۵/۰۶/۲۹"
                  value={sinceDate}
                  onValueChange={(value) =>
                    onChange({ since: joinSince(value, sinceTime) })
                  }
                  inputMode="numeric"
                />
                <TextField
                  label="ساعت (اختیاری)"
                  placeholder="۱۴:۳۰"
                  value={sinceTime}
                  disabled={!sinceDate}
                  onValueChange={(value) =>
                    onChange({ since: joinSince(sinceDate, value) })
                  }
                  inputMode="numeric"
                />
              </div>
              {sinceDate && !sinceTime ? (
                <p className="text-xs text-subtle">از ساعت ۰۰:۰۰ همان روز</p>
              ) : null}
            </div>
          ) : null}

        </div>
      ) : null}

      {chips.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Chip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
