use std::collections::HashSet;

/// Calculates distance in kilometers between two geographic coordinates using Haversine formula
pub fn calculate_haversine_distance(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const EARTH_RADIUS_KM: f64 = 6371.0;

    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();

    let lat1_rad = lat1.to_radians();
    let lat2_rad = lat2.to_radians();

    let a = (d_lat / 2.0).sin().powi(2)
        + lat1_rad.cos() * lat2_rad.cos() * (d_lon / 2.0).sin().powi(2);

    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());

    EARTH_RADIUS_KM * c
}

/// Calculates Jaccard similarity between two lists of string tags
pub fn calculate_jaccard_similarity(user_tags: &[String], item_tags: &[String]) -> f64 {
    if user_tags.is_empty() || item_tags.is_empty() {
        return 0.0;
    }

    let u_set: HashSet<String> = user_tags.iter().map(|t| t.to_lowercase().trim().to_string()).collect();
    let i_set: HashSet<String> = item_tags.iter().map(|t| t.to_lowercase().trim().to_string()).collect();

    let intersection_count = u_set.intersection(&i_set).count();
    let union_count = u_set.union(&i_set).count();

    if union_count == 0 {
        0.0
    } else {
        intersection_count as f64 / union_count as f64
    }
}

/// Reranks items based on Jaccard tag similarity + exponential decay Haversine geo boost
pub fn compute_ranking_score(
    user_tags: &[String],
    item_tags: &[String],
    user_lat: Option<f64>,
    user_lng: Option<f64>,
    item_lat: Option<f64>,
    item_lng: Option<f64>,
    popularity_count: Option<i32>,
) -> f64 {
    let jaccard = calculate_jaccard_similarity(user_tags, item_tags);
    let mut score = jaccard * 50.0;

    if let Some(pop) = popularity_count {
        score += (pop as f64 * 0.5).min(20.0);
    }

    if let (Some(u_lat), Some(u_lng), Some(i_lat), Some(i_lng)) =
        (user_lat, user_lng, item_lat, item_lng)
    {
        let distance = calculate_haversine_distance(u_lat, u_lng, i_lat, i_lng);
        // Exponential decay geo boost: max 40.0, decays by ~63% every 30km
        let geo_boost = 40.0 * (-distance / 30.0).exp();
        score += geo_boost;
    }

    score
}

