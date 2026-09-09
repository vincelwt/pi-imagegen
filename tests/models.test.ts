import assert from "node:assert/strict";
import { test } from "node:test";
import {
	DEFAULT_IMAGE_MODEL,
	isImageQuality,
	resolveImageModel,
} from "../models.ts";

test("defaults to gpt-image-2.5-flare", () => {
	assert.equal(resolveImageModel(undefined), DEFAULT_IMAGE_MODEL);
	assert.equal(resolveImageModel(""), "gpt-image-2.5-flare");
	assert.equal(resolveImageModel("  "), "gpt-image-2.5-flare");
});

test("accepts canonical ids and short aliases", () => {
	assert.equal(resolveImageModel("gpt-image-2.5-flare"), "gpt-image-2.5-flare");
	assert.equal(resolveImageModel("Flare"), "gpt-image-2.5-flare");
	assert.equal(resolveImageModel("2.5"), "gpt-image-2.5-flare");
	assert.equal(resolveImageModel("gpt-image-2.5"), "gpt-image-2.5-flare");
	assert.equal(resolveImageModel("sunburst"), "gpt-image-2.5-sunburst");
	assert.equal(resolveImageModel("2.5-sunburst"), "gpt-image-2.5-sunburst");
	assert.equal(resolveImageModel("gpt-image-2"), "gpt-image-2");
	assert.equal(resolveImageModel("2"), "gpt-image-2");
});

test("rejects unknown models", () => {
	assert.throws(() => resolveImageModel("dall-e-3"), /Unknown image model/);
});

test("recognizes 2.5 quality settings", () => {
	assert.equal(isImageQuality("auto"), true);
	assert.equal(isImageQuality("xhigh"), true);
	assert.equal(isImageQuality("max"), true);
	assert.equal(isImageQuality("ultra"), false);
});
