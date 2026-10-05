import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const target = new URL(`../${process.env.TARGET ?? "starter"}/FilterableList.jsx`, import.meta.url).href;
const { FilterableList } = await import(/* @vite-ignore */ target);

const fruits = ["Apple", "Banana", "Cherry"];
const visibleItems = () => screen.queryAllByRole("listitem").map((li) => li.textContent);

afterEach(cleanup);

describe("FilterableList", () => {
  it("shows every item and the count with an empty query", () => {
    render(<FilterableList items={fruits} />);
    expect(visibleItems()).toEqual(fruits);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 3 of 3");
  });

  it("filters as you type (no Enter needed)", async () => {
    render(<FilterableList items={fruits} />);
    await userEvent.type(screen.getByLabelText("Search"), "an");
    expect(visibleItems()).toEqual(["Banana"]);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 of 3");
  });

  it("filters case-insensitively and ignores surrounding spaces", async () => {
    render(<FilterableList items={fruits} />);
    await userEvent.type(screen.getByLabelText("Search"), "  APP ");
    expect(visibleItems()).toEqual(["Apple"]);
  });

  it("shows No matches when nothing matches", async () => {
    render(<FilterableList items={fruits} />);
    await userEvent.type(screen.getByLabelText("Search"), "kiwi");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByText("No matches")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Showing 0 of 3");
  });

  it("clearing the query brings everything back, in the original order", async () => {
    render(<FilterableList items={fruits} />);
    const input = screen.getByLabelText("Search");
    await userEvent.type(input, "err");
    await userEvent.clear(input);
    expect(visibleItems()).toEqual(fruits);
  });

  it("golden cases", async () => {
    // Under jsdom, import.meta.url isn't a file: URL; tests run from tests/, so read from the cwd.
    const cases = JSON.parse(readFileSync(join(process.cwd(), "cases.json"), "utf8"));
    for (const { items, query, expected } of cases) {
      cleanup();
      render(<FilterableList items={items} />);
      if (query) await userEvent.type(screen.getByLabelText("Search"), query);
      expect(visibleItems(), `${JSON.stringify(items)} / ${JSON.stringify(query)}`).toEqual(expected);
    }
  });
});
