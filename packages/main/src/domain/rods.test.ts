import { describe, expect, it } from "vitest";

import {
  decimetres,
  metresToDecimetres,
  SIX_METRE_ROD_LENGTH,
  THREE_METRE_ROD_LENGTH,
} from "./measurements";
import {
  calculateActiveRodInventory,
  calculateBaseRodString,
  calculateCurrentRodString,
  calculateDrilledLength,
  calculateHoleDepth,
  calculateRodNumber,
  type RodEventInput,
  type RodLength,
} from "./rods";

const addThree: RodEventInput = {
  action: "add",
  rodLength: THREE_METRE_ROD_LENGTH,
};
const addSix: RodEventInput = {
  action: "add",
  rodLength: SIX_METRE_ROD_LENGTH,
};

describe("rod string calculations", () => {
  it("calculates the authoritative BHA and constant stick-up example", () => {
    expect(
      calculateBaseRodString(
        metresToDecimetres(4.3),
        metresToDecimetres(1.8),
      ),
    ).toBe(25);
  });

  it("adds either rod size to the base independently", () => {
    const base = metresToDecimetres(2.5);

    expect(calculateCurrentRodString(base, [addThree])).toBe(55);
    expect(calculateCurrentRodString(base, [addSix])).toBe(85);
  });

  it("supports mixed rods and individual 3 m and 6 m removals", () => {
    const events: readonly RodEventInput[] = [
      addThree,
      addSix,
      addThree,
      { action: "remove", rodLength: THREE_METRE_ROD_LENGTH },
      { action: "remove", rodLength: SIX_METRE_ROD_LENGTH },
    ];

    expect(
      calculateCurrentRodString(metresToDecimetres(2.5), events),
    ).toBe(55);
    expect(calculateActiveRodInventory(events)).toEqual({
      threeMetreRods: 1,
      sixMetreRods: 0,
      totalRods: 1,
      totalLength: 30,
    });
  });

  it("calculates the approved 3 m, 6 m, 3 m, 6 m mixed sequence", () => {
    const events = [addThree, addSix, addThree, addSix] as const;

    expect(
      calculateCurrentRodString(metresToDecimetres(2.5), events),
    ).toBe(205);
    expect(calculateRodNumber(events)).toBe(4);
    expect(calculateActiveRodInventory(events)).toMatchObject({
      threeMetreRods: 2,
      sixMetreRods: 2,
      totalRods: 4,
      totalLength: 180,
    });
  });

  it("calculates hole depth without adding constant stick-up", () => {
    const rodString = metresToDecimetres(5.5);

    expect(calculateHoleDepth(rodString, metresToDecimetres(0))).toBe(55);
    expect(calculateHoleDepth(rodString, metresToDecimetres(0.7))).toBe(48);
    expect(
      calculateHoleDepth(
        metresToDecimetres(14.5),
        metresToDecimetres(1.2),
      ),
    ).toBe(133);
  });

  it("calculates drilled length from the previous completed depth", () => {
    expect(
      calculateDrilledLength(
        metresToDecimetres(13.3),
        metresToDecimetres(10.3),
      ),
    ).toBe(30);
    expect(
      calculateDrilledLength(
        metresToDecimetres(13.3),
        metresToDecimetres(13.3),
      ),
    ).toBe(0);
  });

  it("numbers each addition or removal event once regardless of length", () => {
    expect(calculateRodNumber([addSix])).toBe(1);
    expect(calculateRodNumber([addThree, addSix])).toBe(2);
    expect(
      calculateRodNumber([
        addThree,
        addSix,
        { action: "remove", rodLength: SIX_METRE_ROD_LENGTH },
      ]),
    ).toBe(1);
  });

  it("supports multiple runs with no intervening rod events", () => {
    const base = metresToDecimetres(2.5);
    const events = [addSix] as const;

    const runOneRodString = calculateCurrentRodString(base, events);
    const runTwoRodString = calculateCurrentRodString(base, events);
    const runThreeRodString = calculateCurrentRodString(base, events);

    expect([runOneRodString, runTwoRodString, runThreeRodString]).toEqual([
      85, 85, 85,
    ]);
    expect(calculateRodNumber(events)).toBe(1);
  });

  it("uses effective BHA and constant stick-up configuration changes", () => {
    expect(
      calculateBaseRodString(
        metresToDecimetres(4.5),
        metresToDecimetres(1.8),
      ),
    ).toBe(27);
    expect(
      calculateBaseRodString(
        metresToDecimetres(4.3),
        metresToDecimetres(2),
      ),
    ).toBe(23);
  });

  it("rejects invalid boundaries and rod sizes", () => {
    expect(() =>
      calculateBaseRodString(
        metresToDecimetres(1.7),
        metresToDecimetres(1.8),
      ),
    ).toThrow("BHA - constant stick-up");
    expect(() =>
      calculateHoleDepth(
        metresToDecimetres(0.5),
        metresToDecimetres(0.6),
      ),
    ).toThrow("Hole depth");
    expect(() =>
      calculateRodNumber([
        { action: "remove", rodLength: THREE_METRE_ROD_LENGTH },
      ]),
    ).toThrow("below zero");
    expect(() =>
      calculateCurrentRodString(decimetres(25), [
        {
          action: "add",
          rodLength: decimetres(40) as unknown as RodLength,
        },
      ]),
    ).toThrow("Rod length must be");
  });
});
