export const getPromptsAttributes = (user: any) => {
  const { apiStatus, gender, age, styles } = user;
  const tuneId = apiStatus.id;

  // Combine userSelected and preSelected styles into a single list
  const stylesList = styles.flatMap((styleGroup: any) => styleGroup.styles);

  // Keep track of clothing titles to add variations
  const clothingCounts = new Map();

  return stylesList.map((style: any) => {
    // Count occurrences of each clothing title
    const count = clothingCounts.get(style.clothingTitle) || 0;
    clothingCounts.set(style.clothingTitle, count + 1);

    // Add variation number if this clothing has been used before
    const variationText = count > 0 ? ` (variation ${count + 1})` : '';

    return {
      text: `<lora:${tuneId}:1.0> A professional headshot of ohwx ${gender.toLowerCase()}, age ${age}. Wearing ${style.clothingTitle}${variationText} in ${style.backgroundPrompt}.`
    };
  });
};