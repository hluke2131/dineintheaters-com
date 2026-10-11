import Link from "next/link";
import {
  ALCOHOL_SERVED_LABELS,
  DELIVERY_STYLE_LABELS,
  FILTERABLE_ALCOHOL_SERVED,
  FILTERABLE_DELIVERY_STYLES,
  MENU_PRICE_RANGES,
  type AlcoholServed,
  type DeliveryStyle,
  type MenuPriceRange,
} from "@/lib/theater-fields";

export type ActiveFilters = {
  deliveryStyle: DeliveryStyle[];
  alcoholServed: AlcoholServed[];
  menuPriceRange: MenuPriceRange[];
  reservedRecliners: boolean;
};

const legendClass = "font-display text-sm uppercase tracking-wide text-burgundy-dark";
const labelClass = "flex items-center gap-2 text-sm text-ink/80";

/** A plain GET form: submitting it puts the selected filters in the URL, so
 * results are server-rendered, shareable, and back-button safe. Works with no
 * client JavaScript. Page number is intentionally not carried over — changing
 * filters starts again from page 1. */
function FilterForm({ active, hasActive }: { active: ActiveFilters; hasActive: boolean }) {
  return (
    <form method="get" action="/dine-in-theaters" className="space-y-6">
      <fieldset>
        <legend className={legendClass}>Delivery style</legend>
        <div className="mt-3 space-y-2">
          {FILTERABLE_DELIVERY_STYLES.map((value) => (
            <label key={value} className={labelClass}>
              <input
                type="checkbox"
                name="delivery_style"
                value={value}
                defaultChecked={active.deliveryStyle.includes(value)}
                className="accent-burgundy"
              />
              {DELIVERY_STYLE_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legendClass}>Alcohol</legend>
        <div className="mt-3 space-y-2">
          {FILTERABLE_ALCOHOL_SERVED.map((value) => (
            <label key={value} className={labelClass}>
              <input
                type="checkbox"
                name="alcohol_served"
                value={value}
                defaultChecked={active.alcoholServed.includes(value)}
                className="accent-burgundy"
              />
              {ALCOHOL_SERVED_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legendClass}>Price range</legend>
        <div className="mt-3 space-y-2">
          {MENU_PRICE_RANGES.map((value) => (
            <label key={value} className={labelClass}>
              <input
                type="checkbox"
                name="menu_price_range"
                value={value}
                defaultChecked={active.menuPriceRange.includes(value)}
                className="accent-burgundy"
              />
              {value}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legendClass}>Seating</legend>
        <div className="mt-3">
          <label className={labelClass}>
            <input
              type="checkbox"
              name="reserved_recliners"
              value="true"
              defaultChecked={active.reservedRecliners}
              className="accent-burgundy"
            />
            Reserved recliners
          </label>
        </div>
      </fieldset>

      <div className="space-y-3">
        <button
          type="submit"
          className="w-full rounded-full bg-burgundy px-4 py-2.5 font-medium text-cream hover:bg-burgundy-dark"
        >
          Apply filters
        </button>
        {hasActive ? (
          <Link
            href="/dine-in-theaters"
            className="block text-center text-sm text-ink/60 underline hover:text-burgundy"
          >
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}

/** Filters sidebar on large screens; a collapsed "Filters" disclosure on
 * small ones. The form is rendered once per breakpoint (the hidden copy is
 * display:none, so it's out of the tab order and the accessibility tree). */
export function DirectoryFilterPanel({
  active,
  hasActive,
  activeCount,
}: {
  active: ActiveFilters;
  hasActive: boolean;
  activeCount: number;
}) {
  return (
    <aside>
      <details className="rounded-xl border border-burgundy/10 bg-white lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 font-medium text-burgundy-dark [&::-webkit-details-marker]:hidden">
          <span>
            Filters
            {activeCount > 0 ? (
              <span className="ml-2 rounded-full bg-burgundy px-2 py-0.5 text-xs text-cream">
                {activeCount}
              </span>
            ) : null}
          </span>
          <span aria-hidden="true" className="text-ink/50">
            +
          </span>
        </summary>
        <div className="border-t border-burgundy/10 p-5">
          <FilterForm active={active} hasActive={hasActive} />
        </div>
      </details>

      <div className="hidden rounded-xl border border-burgundy/10 bg-white p-5 lg:block">
        <FilterForm active={active} hasActive={hasActive} />
      </div>
    </aside>
  );
}
