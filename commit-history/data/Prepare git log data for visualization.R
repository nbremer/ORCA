setwd("~/Downloads")

library(tidyverse)
library(ggplot2)

# Clone the git repository into a folder
# git clone https://github.com/mozilla/pdf.js.git
# Save the git log to a file
# These two don't give the most recent commits
# git log --pretty='format:commit,%H,\"%D\",%ce,\"%cN\",%ci,%ae,\"%aN\",%ai,\"%s\"' --shortstat --tags -M20 -C20 > log.txt
# git log --pretty='format:commit,%H,^%D^,%ce,^%cN^,%ci,%ae,^%aN^,%ai,^%s^' --shortstat --tags  -M20 -C20 origin/master
# This one does:
# ( echo "commit_hash","decorations","committer_email","committer_name","commit_time","author_email","author_name","author_time","commit_title"; git log --pretty='format:commit,%H,^%D^,%ce,^%cN^,%ci,%ae,^%aN^,%ai,^%s^' --shortstat --tags -M20 -C20 origin/master ) > log.txt
# ..) | tee log.txt 
# -> will also print it out (with -a to append)

################################################################################
################################################################################
################################################################################

repo <- "pdfjs"
# repo <- "d3"
filename <- paste0("log_",repo,".txt")

col_names <- c("commit_hash","decorations","committer_email","committer_name","commit_time","author_email","author_name","author_time","commit_title",
               "files_changed","line_insertions","line_deletions")

# Test: Input string
# input_string <- "commit, a10166cc71094815addfc9cbdd56922016c98c41, ^HEAD -> main, origin/main, origin/HEAD^, noreply@github.com, ^GitHub^, 2025-01-25 15:54:27 +0100, fil@rezo.net, ^Philippe Rivière^, 2025-01-25 15:54:27 +0100, ^Update CHANGES.md^"
# splitLine(input_string)

# This feels like an overly difficult way to split the commit line by comma's except when the comma is between ^ marks
splitLine <- function(input_string) {
  # Step 1: Extract quoted parts
  quoted_parts <- str_extract_all(input_string, "\\^.*?\\^")[[1]]
  
  # Step 2: Remove quoted parts from the original string
  remaining_string <- str_replace_all(input_string, "\\^.*?\\^", "QUOTED_PART")
  
  # Step 3: Split the remaining string by commas
  split_remaining <- str_split(remaining_string, ",\\s*")[[1]]
  
  # Step 4: Replace placeholders with the actual quoted parts
  count <- 1
  result <- sapply(split_remaining, function(x) {
    if (x == "QUOTED_PART") {
      text <- quoted_parts[count]
      count <<- count + 1
      return(text)
    } else {
      return(x)
    }
  })
  result <- unname(result)
  
  # Step 5: Remove all instances of the "^" character
  result <- gsub("\\^", "", result)
  
  # Print the result
  return(result)
}# function splitLine

################################################################################
# Read the file line by line - Can take a minute or two
con <- file(filename, "r")
count <- 0
data <- tibble(
  commit_hash = character(),
  decorations = character(),
  committer_email = character(),
  committer_name = character(),
  commit_time = character(),
  author_email = character(),
  author_name = character(),
  author_time = character(),
  commit_title = character(),
  files_changed = numeric(),
  line_insertions = numeric(),
  line_deletions = numeric()
)

# Loop over each line
while ( TRUE ) {
  line <- readLines(con, n = 1)
  if(count == 0) {
    count <- count + 1
    next # The first line are the headers, just to remember them
  }# if
  
  # End of the file found
  if ( length(line) == 0 ) {
    break
  } # if
  
  count <- count + 1
  if(count %% 1000 == 0) print(count)
  
  # Move on if this is an empty line
  if (line == "") next
  
  # If the line starts with "commit" I can put the rest into a dataframe
  if(grepl("^commit", line)) {
    # Turn the string into a table, while also adding three zeros at the end for the file changes
    # variables <- read.table(text = paste0(line,",0,0,0"), sep = ",", quote = '\"')
    # variables <- read_delim(file=I(paste0(line,",0,0,0")), delim=',', col_names = col_names, escape_double=FALSE, escape_backslash=TRUE, quote = '^', show_col_types = FALSE)
    # Maybe try data.table::fread, or read_files()
    
    variables <- splitLine(paste0(line,",0,0,0"))
    
    # Remove the first element ("commit")
    variables <- t(variables[-1])
    
    # Set the right column names
    colnames(variables) <- col_names
    variables <- as_tibble(variables)
    variables$files_changed <- as.numeric(variables$files_changed)
    variables$line_insertions <- as.numeric(variables$line_insertions)
    variables$line_deletions <- as.numeric(variables$line_deletions)
    
    # Add to the overall dataset
    data <- bind_rows(data, as_tibble(variables))
  
  # If this line contains the word "changed", it contains information about the number of changes in the commit from the previous line
  } else if(grepl("changed", line)) {
    variables <- unlist(strsplit(line, ","))
    
    # Get the number from the first element for the number of files changed
    files_changed <- as.numeric(gsub("\\D", "", variables[1]))
    line_insertions <- 0
    line_deletions <- 0
    
    # Check of the second entry has the word "insertions", if yes, save the number
    if(grepl("insertion", variables[2])) {
      # Get the number
      line_insertions <- as.numeric(gsub("\\D", "", variables[2]))
      # If there is a third entry, it will be the number of deletions
      if(length(variables) == 3) {
        line_deletions <- as.numeric(gsub("\\D", "", variables[3]))
      }# if
    } else if(grepl("delection", variables[2])) {
      # Otherwise check if the second entry is the number of deletions
      line_deletions <- as.numeric(gsub("\\D", "", variables[2]))
    }# else
    
    # Add these numbers to the last line of the dataset
    data$files_changed[nrow(data)] <- files_changed
    data$line_insertions[nrow(data)] <- line_insertions
    data$line_deletions[nrow(data)] <- line_deletions
    # updates <- c(files_changed, line_insertions, line_deletions)
  }# else if
  
} # while
close(con)
rm(variables, files_changed, line_insertions, line_deletions, line, con, filename, count, col_names)

# Remove quotes from description
data$commit_title <- gsub("\"", "", data$commit_title)

write.csv(data, file = paste0("commits_",repo,".csv"), row.names = F, na = "")

