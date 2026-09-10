export const IMAGE_MODELS = ["gpt-image-2.5-sunburst", "gpt-image-2.5-flare", "gpt-image-2"] as const;
export type ImageModel = (typeof IMAGE_MODELS)[number];
export const DEFAULT_IMAGE_MODEL: ImageModel = "gpt-image-2.5-sunburst";

export const QUALITIES = ["auto", "low", "medium", "high", "xhigh", "max"] as const;
export type ImageQuality = (typeof QUALITIES)[number];
export const DEFAULT_QUALITY: ImageQuality = "high";

const IMAGE_MODEL_ALIASES: Record<string, ImageModel> = {
	"gpt-image-2.5-sunburst": "gpt-image-2.5-sunburst",
	"gpt-image-2.5-flare": "gpt-image-2.5-flare",
	"gpt-image-2.5": "gpt-image-2.5-sunburst",
	"gpt-image-2": "gpt-image-2",
	sunburst: "gpt-image-2.5-sunburst",
	flare: "gpt-image-2.5-flare",
	"2.5": "gpt-image-2.5-sunburst",
	"2.5-sunburst": "gpt-image-2.5-sunburst",
	"2.5-flare": "gpt-image-2.5-flare",
	"2": "gpt-image-2",
};

export function resolveImageModel(value: string | undefined): ImageModel {
	if (value == null || value.trim() === "") return DEFAULT_IMAGE_MODEL;
	const resolved = IMAGE_MODEL_ALIASES[value.trim().toLowerCase()];
	if (!resolved) {
		throw new Error(
			`Unknown image model '${value}'. Use gpt-image-2.5-sunburst (default), gpt-image-2.5-flare, or gpt-image-2.`,
		);
	}
	return resolved;
}

export function isImageQuality(value: string): value is ImageQuality {
	return (QUALITIES as readonly string[]).includes(value);
}

export function resolveQuality(value: string | undefined): ImageQuality {
	if (value == null || value.trim() === "") return DEFAULT_QUALITY;
	const quality = value.trim().toLowerCase();
	if (!isImageQuality(quality)) {
		throw new Error(`Unknown quality '${value}'. Use auto, low, medium, high, xhigh, or max.`);
	}
	return quality;
}
