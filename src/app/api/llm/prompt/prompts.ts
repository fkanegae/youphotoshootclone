export const getPromptsAttributes = (user: any) => {
  const { apiStatus, gender, age, styles } = user;
  const tuneId = apiStatus.id;

  // 1. Always ensure exactly 10 unique prompts
  const baseStyles = styles.flatMap((styleGroup: any) => 
    styleGroup.styles.map((style: any) => ({
      ...style,
      groupId: styleGroup.id // Preserve group ID for variation tracking
    }))
  );

  // 2. Fill missing styles with default variations
  const defaultStyles = Array(10).fill(null).map((_, i) => ({
    clothingTitle: `Professional Attire Variation ${i + 1}`,
    backgroundPrompt: 'Studio Background',
    groupId: 'default'
  }));

  // 3. Merge and limit to 10 unique styles
  const finalStyles = [...baseStyles, ...defaultStyles]
    .filter((v, i, a) => a.findIndex(t => 
      t.clothingTitle === v.clothingTitle && 
      t.backgroundPrompt === v.backgroundPrompt
    ) === i)
    .slice(0, 10);

  // 4. Generate guaranteed 10 unique prompts
  return finalStyles.map((style, index) => ({
    text: `<lora:${tuneId}:1.0> A professional headshot of ohwx ${gender.toLowerCase()}, age ${age}. Wearing ${style.clothingTitle} in ${style.backgroundPrompt}. Variation ${index + 1}.`
  }));
};