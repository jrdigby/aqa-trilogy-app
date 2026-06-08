export async function startAnyPractice(context) {
  const { 
    supabaseClient,
    getSelectedFilters, 
    timeoutPromise, 
    showToastBanner, 
    shuffleArray, 
    loadQuestion,
    setSessionState, 
    getDomSections 
  } = context;
  const { subject, paper, topic, qType, tier } = getSelectedFilters();
  const targetTiers = tier === "HT" ? ["HT", "both"] : ["FT", "both"];

  console.log("DEBUG startAnyPractice: Locating practice targets...");
  let query = supabaseClient
    .from("spec_points")
    .select("id, subject, paper, topic_name")
    .eq("subject", subject)
    .eq("paper", paper);

  if (topic) {
    query = query.eq("topic_name", topic);
  }

  let sp = [];
  try {
    const result = await Promise.race([query, timeoutPromise(4000, "Syllabus items query timed out")]);
    if (result.error) throw result.error;
    sp = result.data || [];
  } catch (err) {
    showToastBanner("Connection error loading syllabus definitions: " + err.message, true);
    return;
  }

  if (!sp || sp.length === 0) {
    showToastBanner(`No matching specification items found for your selection choices.`, true);
    return;
  }

  const matchingSpecPointIds = sp.map(item => item.id);

  let qQuery = supabaseClient
    .from("questions")
    .select("id,question_type,prompt,options,spec_point_id, resource_links, marking_method, max_marks, image_url, scaffold_config")
    .in("spec_point_id", matchingSpecPointIds)
    .in("tier", targetTiers);
      
  if (qType) {
    qQuery = qQuery.eq("question_type", qType);
  }
    
  let activeQs = [];
  try {
    const result = await Promise.race([qQuery, timeoutPromise(4000, "Practice pool matching timed out")]);
    if (result.error) throw result.error;
    activeQs = result.data || [];
  } catch (err) {
    console.error("DEBUG startAnyPractice: Questions lookup failure context:", err);
    showToastBanner("Database error matching practice pool: " + err.message, true);
    return;
  }

 if (activeQs.length === 0) {
    const typeLabel = qType === "extended_response" ? "Extended Response" : (qType === "short_text" ? "Short Text / Written" : (qType || "any"));
    showToastBanner(`No structural questions found of type "${typeLabel}" loaded for the selected ${tier} tier topics.`, true);
    return;
  }

  // 🌟 1. Safe state update via the context bundle helper
  const localizedQs = shuffleArray(activeQs).slice(0, 10);
  setSessionState(localizedQs, 0);

  // 🌟 2. Extract the actual DOM elements from our context helper
  const { dashSection, sessionSection } = getDomSections();
  
  if (dashSection) dashSection.classList.add("hidden");
  if (sessionSection) sessionSection.classList.remove("hidden");
  
  // 🌟 3. Trigger the next step via the context helper
  await loadQuestion();
}

export async function startSessionForSpecPoint(specPointId, qType = "", context) {
  const { 
    supabaseClient,
    getSelectedFilters, 
    timeoutPromise, 
    showToastBanner, 
    shuffleArray, 
    loadQuestion,
    setSessionState, 
    getDomSections 
  } = context;
  const { tier } = getSelectedFilters();
  const targetTiers = tier === "HT" ? ["HT", "both"] : ["FT", "both"];

  console.log("DEBUG startSessionForSpecPoint: Loading question payloads...");
  let query = supabaseClient
    .from("questions")
    .select("id,question_type,prompt,options,spec_point_id, resource_links, marking_method, max_marks, image_url, scaffold_config")
    .eq("spec_point_id", specPointId)
    .in("tier", targetTiers);

  if (qType) {
    query = query.eq("question_type", qType);
  }

  let qs = [];
  try {
    const result = await Promise.race([query.limit(10), timeoutPromise(4000, "Questions loading query timed out")]);
    if (result.error) throw result.error; 
    qs = result.data || [];
  } catch (err) {
    console.error("DEBUG startSessionForSpecPoint: Questions loading error:", err);
    showToastBanner("Database error loading questions list: " + err.message, true);
    return;
  }

  if (!qs || qs.length === 0) {
    showToastBanner(`No structural questions found matching your filter rules for this topic folder.`, true);
    return;
  }

  // 🌟 1. Safe state update via the context bundle helper
  const localizedQs = shuffleArray(qs);
  setSessionState(localizedQs, 0);

  // 🌟 2. Extract the actual DOM elements from our context helper
  const { dashSection, sessionSection } = getDomSections();

  if (dashSection) dashSection.classList.add("hidden");
  if (sessionSection) sessionSection.classList.remove("hidden");
  await loadQuestion();
}
