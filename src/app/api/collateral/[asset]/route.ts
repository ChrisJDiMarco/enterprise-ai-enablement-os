import { NextResponse } from "next/server";
import { collateralAssets, collateralFilename, collateralPayload } from "@/lib/marketing-site";

export const dynamic = "force-static";

export function generateStaticParams() {
  return collateralAssets.map((asset) => ({ asset: asset.id }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ asset: string }> }) {
  const { asset: assetId } = await params;
  const asset = collateralAssets.find((item) => item.id === assetId);
  const payload = collateralPayload(assetId);

  if (!asset || payload === null) {
    return NextResponse.json({ error: "Collateral asset not found." }, { status: 404 });
  }

  if (asset.format === "JSON") {
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${collateralFilename(asset)}"`,
      },
    });
  }

  return new NextResponse(String(payload), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${collateralFilename(asset)}"`,
    },
  });
}
