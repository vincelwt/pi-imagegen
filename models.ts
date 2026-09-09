export const IMAGE_MODELS = ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "gpt-image-2"] as const;
export type ImageModel = (typeof IMAGE_MODELS)[number];
export const DEFAULT_IMAGE_MODEL: ImageModel = "gpt-image-2.5-flare";

export const QUALITIES = ["auto", "low", "medium", "high", "xhigh", "max"] as const;
export type ImageQuality = (typeof QUALITIES)[number];

const IMAGE_MODEL_ALIASES: Record<string, ImageModel> = {
	"gpt-image-2.5-flare": "gpt-image-2.5-flare",
	"gpt-image-2.5-sunburst": "gpt-image-2.5-sunburst",
	"gpt-image-2.5": "gpt-image-2.5-flare",
	"gpt-image-2": "gpt-image-2",
	flare: "gpt-image-2.5-flare",
	sunburst: "gpt-image-2.5-sunburst",
	"2.5": "gpt-image-2.5-flare",
	"2.5-flare": "gpt-image-2.5-flare",
	"2.5-sunburst": "gpt-image-2.5-sunburst",
	"2": "gpt-image-2",
};

export function resolveImageModel(value: string | undefined): ImageModel {
	if (value == null || value.trim() === "") return DEFAULT_IMAGE_MODEL;
	const resolved = IMAGE_MODEL_ALIASES[value.trim().toLowerCase()];
	if (!resolved) {
		throw new Error(
			`Unknown image model '${value}'. Use gpt-image-2.5-flare (default), gpt-image-2.5-sunburst, or gpt-image-2.`,
		);
	}
	return resolved;
}

export function isImageQuality(value: string): value is ImageQuality {
	return (QUALITIES as readonly string[]).includes(value);
}
