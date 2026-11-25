package com.ggumtak.myamgi.provider

/**
 * A query answer before it becomes a Cursor: the columns the caller asked for, how many rows, and each row
 * computed only when it is read. Over IPC Android copies a cursor into windows of about 2MB, row by row, so a
 * search that finds 20,000 notes loads only the notes that fit in the window the caller actually reads.
 *
 * [rowAt] is called with the row index and the column names; it must return one value per column.
 * Pure Kotlin: tested on the JVM; [MyAmgiProvider] wraps it in an Android cursor.
 */
class ProviderTable(
    val columns: Array<String>,
    val count: Int,
    private val rowAt: (index: Int, columns: Array<String>) -> Array<Any?>,
) {
    private var cachedIndex = -1
    private var cachedRow: Array<Any?> = emptyArray()

    /** The row at [index], computed once for consecutive reads of its columns. */
    @Synchronized
    fun row(index: Int): Array<Any?> {
        require(index in 0 until count) { "Row $index out of 0..<$count" }
        if (index != cachedIndex) {
            val r = rowAt(index, columns)
            check(r.size == columns.size) { "Row has ${r.size} values for ${columns.size} columns" }
            cachedRow = r
            cachedIndex = index
        }
        return cachedRow
    }

    fun value(index: Int, column: Int): Any? = row(index)[column]

    fun columnIndex(name: String): Int = columns.indexOf(name)

    /** Every row, for tests and small answers. */
    fun rows(): List<List<Any?>> = List(count) { row(it).toList() }

    companion object {
        fun of(columns: Array<String>, rows: List<Map<String, Any?>>): ProviderTable =
            ProviderTable(columns, rows.size) { i, cols -> Array(cols.size) { rows[i][cols[it]] } }
    }
}
