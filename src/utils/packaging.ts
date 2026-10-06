/** Display name of a selling packaging: the base unit has no packaging name, so fall back to the unit ("Kilogram", "Chai"). */
export function packagingLabel(p: { packagingName?: string | null; unitName?: string | null; symbol?: string | null }): string {
  return p.packagingName || p.unitName || p.symbol || 'Đơn vị'
}

/** "126 chai" style text for a quantity in base units, with the pack equivalent when it divides evenly ("= 21 hộp"). */
export function describeBaseQuantity(baseQuantity: number, conversionToBase: number, packName: string): string {
  if (conversionToBase > 1 && baseQuantity % conversionToBase === 0) {
    return `${baseQuantity / conversionToBase} ${packName.toLowerCase()}`
  }
  return `${baseQuantity} đơn vị cơ sở`
}
