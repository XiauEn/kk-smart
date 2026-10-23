import { afterEach, describe, expect, it, vi } from "vitest";
import { GateAudio } from "../apps/gate-scanner/src/audio";

const oscillators: {
  stop: ReturnType<typeof vi.fn>;
  frequency: { exponentialRampToValueAtTime: ReturnType<typeof vi.fn> };
}[] = [];
class FakeAudioContext {
  state = "suspended";
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
  createOscillator() {
    const osc = {
      frequency: { value: 0, exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    };
    oscillators.push(osc);
    return osc;
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
}
afterEach(() => {
  oscillators.length = 0;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("gate audio lifecycle", () => {
  it("plays a distinct sound on a single denial", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const audio = new GateAudio();
    await audio.unlock();
    audio.play("denied");
    expect(oscillators.length).toBeGreaterThan(0);
    audio.dispose();
  });
  it("speaks the welcome after the ding and cancels pending speech on mute", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const speak = vi.fn(),
      cancel = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
      },
    );
    const audio = new GateAudio();
    await audio.unlock();
    audio.play("success");
    expect(speak).not.toHaveBeenCalled();
    vi.advanceTimersByTime(850);
    expect(speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Welcome to K K six seven" }),
    );
    audio.play("success");
    audio.setMuted(true);
    vi.advanceTimersByTime(1000);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalled();
    audio.dispose();
  });
  it("requires activation before playing", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const audio = new GateAudio();
    audio.play("success");
    expect(oscillators).toHaveLength(0);
    expect(await audio.unlock()).toBe(true);
    audio.play("success");
    expect(oscillators.length).toBeGreaterThan(0);
    audio.dispose();
  });
  it("mute immediately stops a siren and prevents new sounds", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const audio = new GateAudio();
    await audio.unlock();
    audio.play("alarm");
    const count = oscillators.length;
    oscillators.forEach((osc) => osc.stop.mockClear());
    audio.setMuted(true);
    oscillators.forEach((osc) => expect(osc.stop).toHaveBeenCalledOnce());
    audio.play("denied");
    expect(oscillators).toHaveLength(count);
    expect(await audio.unlock()).toBe(false);
    audio.dispose();
  });
  it("creates a repeated frequency sweep for the alarm", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const audio = new GateAudio();
    await audio.unlock();
    audio.play("alarm");
    expect(
      oscillators[0].frequency.exponentialRampToValueAtTime.mock.calls.length,
    ).toBeGreaterThan(2);
    audio.dispose();
  });
  it("handles unavailable browser audio without affecting verification", async () => {
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw new Error("Unavailable");
        }
      },
    );
    const audio = new GateAudio();
    expect(await audio.unlock()).toBe(false);
    expect(() => audio.play("denied")).not.toThrow();
    audio.dispose();
  });
});
