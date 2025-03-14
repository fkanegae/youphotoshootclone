export const getPromptsAttributes = (user: any) => {
  const { apiStatus, gender, age, styles } = user;
  const tuneId = apiStatus.id;

  // Combine userSelected and preSelected styles into a single list
  const stylesList = styles.flatMap((styleGroup: any) => styleGroup.styles);

  return stylesList.map((style: any) => ({
    text: `<lora:${tuneId}:1.0> A professional headshot of ohwx ${gender.toLowerCase()}, age ${age}. Wearing ${style.clothingTitle} in ${style.backgroundPrompt}.`
  }));
};