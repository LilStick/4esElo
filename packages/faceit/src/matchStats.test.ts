import { test } from "node:test";
import assert from "node:assert/strict";
import { FaceitClient } from "./client";

function fakeFetch(response: Response) {
  const impl = (async () => response.clone()) as typeof fetch;
  return impl;
}

const MATCH_PAYLOAD = {
  rounds: [
    {
      round_stats: { Map: "de_mirage", Score: "13 / 8", Winner: "faction1", Rounds: "21" },
      teams: [
        {
          players: [
            {
              player_id: "p-win",
              nickname: "winner",
              player_stats: {
                Kills: "24",
                Deaths: "15",
                Assists: "5",
                "K/D Ratio": "1.6",
                "K/R Ratio": "1.14",
                ADR: "92.5",
                Damage: "1943",
                "Headshots %": "58",
                MVPs: "4",
                "Triple Kills": "2",
                "1v1Count": "3",
                "1v1Wins": "2",
                "1v2Count": "1",
                "1v2Wins": "1",
                "Entry Count": "6",
                "Entry Wins": "4",
                "First Kills": "5",
                "Utility Damage": "180",
                Result: "1",
              },
            },
          ],
        },
        {
          players: [
            {
              player_id: "p-lose",
              nickname: "loser",
              player_stats: { Kills: "18", Deaths: "20", ADR: "71.2", Result: "0" },
            },
          ],
        },
      ],
    },
  ],
};

test("getMatchStats normalizes map, result and per-player stats", async () => {
  const client = new FaceitClient("k", {
    fetchImpl: fakeFetch(new Response(JSON.stringify(MATCH_PAYLOAD))),
  });

  const detail = await client.getMatchStats("m-1");
  assert.ok(detail);
  assert.equal(detail.matchId, "m-1");
  assert.equal(detail.map, "de_mirage");
  assert.equal(detail.players.length, 2);

  const winner = detail.players.find((p) => p.playerId === "p-win")!;
  assert.equal(winner.result, 1);
  assert.equal(winner.stats.kills, 24);
  assert.equal(winner.stats.adr, 92.5);
  assert.equal(winner.stats.hsPercent, 58);
  assert.equal(winner.stats.clutch1v1Wins, 2);
  assert.equal(winner.stats.entryWins, 4);

  const loser = detail.players.find((p) => p.playerId === "p-lose")!;
  assert.equal(loser.result, 0);
  // missing fields default to 0 (loose parsing)
  assert.equal(loser.stats.clutch1v1Count, 0);
  assert.equal(loser.stats.mvps, 0);
});
