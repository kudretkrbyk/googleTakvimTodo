package com.sade.calendar.widget

import android.content.Context
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

// Private app storage contains only a bounded, token-free widget projection.
object WidgetDataRepository {
  fun preferences(context: Context) = context.getSharedPreferences("task_widget", Context.MODE_PRIVATE)
  fun save(context: Context, json: String, days: Int) {
    preferences(context).edit().putString("entries", json).putInt("default_days", days).apply()
  }
  fun rows(context: Context, widgetId: Int): List<WidgetRow> {
    val prefs = preferences(context)
    val days = prefs.getInt("days_$widgetId", prefs.getInt("default_days", 7))
    // Civil ISO date strings sort lexically and work on Android 24 without
    // java.time desugaring or another native dependency.
    val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    val calendar = Calendar.getInstance()
    val today = formatter.format(calendar.time)
    calendar.add(Calendar.DAY_OF_YEAR, 1)
    val tomorrow = formatter.format(calendar.time)
    calendar.add(Calendar.DAY_OF_YEAR, days - 1)
    val end = formatter.format(calendar.time)
    val array = JSONArray(prefs.getString("entries", "[]"))
    return (0 until array.length()).mapNotNull { index ->
      val row = array.getJSONObject(index)
      val date = row.getString("date")
      if (date < today || date >= end) return@mapNotNull null
      val label = when (date) { today -> "Bugün"; tomorrow -> "Yarın"; else -> "${date.substring(8,10)}.${date.substring(5,7)}" }
      WidgetRow(row.getString("title"), label, row.getString("time"))
    }
  }
}
data class WidgetRow(val title: String, val group: String, val time: String)
