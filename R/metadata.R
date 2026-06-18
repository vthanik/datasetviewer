# Per-column metadata for the panels (Label/Name/Length/Type/Format/Informat)
# plus a precise `kind` used by the browser to pick icons and filter editors.
#
# When artoo is installed, artoo::columns() is the universal extractor: a
# PROC CONTENTS-style view that reads labels, formats, and informats from a
# labelled frame or an artoo-conformed frame, and infers type/length from the
# data. Without artoo, the fields are synthesized from R types and any base
# `label` attribute.

.dv_columns_meta <- function(x) {
  if (requireNamespace("artoo", quietly = TRUE)) {
    .dv_meta_from_artoo(x)
  } else {
    .dv_meta_synth(x)
  }
}

# Extract via artoo::columns(). The Informat column is present only when at
# least one variable carries one. Numeric Len is blank in PROC CONTENTS style;
# we surface 8 (the SAS numeric storage length) so the property panel is
# consistent with the synthesized path.
.dv_meta_from_artoo <- function(x) {
  co <- artoo::columns(x)
  has_informat <- "Informat" %in% names(co)
  lapply(seq_len(nrow(co)), function(i) {
    type <- as.character(co$Type[i])
    len <- .dv_blank(co$Len[i])
    if (identical(type, "Num") && !nzchar(len)) {
      len <- "8"
    }
    list(
      name = as.character(co$Variable[i]),
      label = .dv_blank(co$Label[i]),
      type = type,
      kind = .dv_kind_from_artoo(type, .dv_blank(co$Format[i])),
      length = len,
      format = .dv_blank(co$Format[i]),
      informat = if (has_informat) .dv_blank(co$Informat[i]) else ""
    )
  })
}

# Synthesize from R types. Labels come from a base `label` attribute when set;
# format/informat are unknown.
.dv_meta_synth <- function(x) {
  lapply(names(x), function(nm) {
    col <- x[[nm]]
    lbl <- attr(col, "label", exact = TRUE)
    list(
      name = nm,
      label = if (is.character(lbl) && length(lbl) == 1L) lbl else "",
      type = .dv_col_type(col),
      kind = .dv_col_kind(col),
      length = .dv_col_length(col),
      format = "",
      informat = ""
    )
  })
}

# SAS-style type for the property panel and grid alignment: "Num" or "Char".
# Dates and times are stored numerically in SAS, so they are "Num".
.dv_col_type <- function(col) {
  if (is.numeric(col) || inherits(col, c("Date", "POSIXt", "difftime"))) {
    "Num"
  } else {
    "Char"
  }
}

# Precise kind for the browser (icon + filter editor): number, string, bool,
# date, datetime, time.
.dv_col_kind <- function(col) {
  if (inherits(col, "Date")) {
    "date"
  } else if (inherits(col, "POSIXt")) {
    "datetime"
  } else if (inherits(col, c("difftime", "hms"))) {
    "time"
  } else if (is.logical(col)) {
    "bool"
  } else if (is.numeric(col)) {
    "number"
  } else {
    "string"
  }
}

# SAS-style storage length, as a character string for a stable payload type:
# numeric/date/time columns are 8 bytes; character columns the widest value in
# bytes (NA values excluded).
.dv_col_length <- function(col) {
  if (identical(.dv_col_type(col), "Num")) {
    return("8")
  }
  v <- as.character(col)
  v <- v[!is.na(v)]
  if (!length(v)) {
    return("")
  }
  as.character(max(nchar(v, type = "bytes")))
}

# Best-effort kind for an artoo column from its SAS Type + display format. The
# browser engine refines this from the Arrow schema once data loads, so this
# only needs to be right for the brief pre-load render.
.dv_kind_from_artoo <- function(type, format) {
  fmt <- toupper(format)
  if (nzchar(fmt)) {
    if (grepl("DATETIME|E8601DT", fmt)) {
      return("datetime")
    }
    if (grepl("TIME|HHMM|E8601TM", fmt)) {
      return("time")
    }
    if (grepl("DATE|YYMMDD|DDMMYY|MMDDYY|MONYY|E8601DA|JULIAN", fmt)) {
      return("date")
    }
  }
  if (identical(type, "Num")) "number" else "string"
}

# NA / non-scalar -> "" ; otherwise the value as a string.
.dv_blank <- function(v) {
  if (length(v) != 1L || is.na(v)) {
    return("")
  }
  as.character(v)
}
