import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchPanel } from "./search-panel";

describe("SearchPanel", () => {
  it("searches the API and selects a result", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify([
          { id: "FMA:7088", name: "heart", system_id: "cardiovascular", laterality: "unspecified",
            is_compound: true, has_geometry: true, score: 2.5, matched_text: "Cor" },
        ]),
      ),
    );
    const onSelect = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SearchPanel onSelect={onSelect} />
      </QueryClientProvider>,
    );
    await userEvent.type(screen.getByRole("searchbox"), "cor");
    const hit = await screen.findByText("heart");
    expect(screen.getByText(/matched “Cor”/)).toBeInTheDocument();
    expect(String(fetchMock.mock.calls.at(-1)![0])).toContain("/api/v1/anatomy/search?q=cor");
    await userEvent.click(hit);
    expect(onSelect).toHaveBeenCalledWith("FMA:7088");
  });
});
