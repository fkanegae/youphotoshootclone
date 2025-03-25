export const getPromptsAttributes = (user: any) => {
  const { apiStatus, gender, age, styles } = user;
  const tuneId = apiStatus.id;

  // Get all styles from userSelected array, since preSelected is now empty
  // Fallback to an empty array if styles or userSelected is missing
  const userStyles = styles?.find((s: any) => s.type === "userSelected")?.styles || [];
  
  // Ensure we have exactly 10 styles for prompt generation
  if (userStyles.length !== 10) {
    console.warn(`Expected 10 styles but got ${userStyles.length}. This might affect image generation.`);
  }

  // Keep track of clothing titles to add variations
  const clothingCounts = new Map();

  return userStyles.map((style: any) => {
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