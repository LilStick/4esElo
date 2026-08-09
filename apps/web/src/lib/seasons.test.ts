import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Season } from "@4eselo/types";
import { currentSeasonId } from "./seasons";

const s = (id: string, endsAt: string | null): Season => ({
  id,
  label: id,
  startsAt: "2026-01-01T00:00:00.000Z",
  endsAt,
});

describe("currentSeasonId", () => {
  it("prend la saison marquée courante (endsAt null)", () => {
    assert.equal(currentSeasonId([s("S7", "2026-04-22T00:00:00.000Z"), s("S8", null)]), "S8");
  });

  it("fallback sur la dernière si aucune n'est marquée courante", () => {
    assert.equal(
      currentSeasonId([s("S7", "2026-04-22T00:00:00.000Z"), s("S8", "2026-08-01T00:00:00.000Z")]),
      "S8",
    );
  });

  it("undefined si la liste est vide", () => {
    assert.equal(currentSeasonId([]), undefined);
  });
});
