library(tidyverse)

# Clone the git repository into a folder
# git clone https://github.com/mozilla/pdf.js.git
# Go into the folder and run the following line to save the git log to a file called log.txt
# ( echo "commit_hash","decorations","committer_email","committer_name","commit_time","author_email","author_name","author_time","commit_title"; git log --pretty='format:commit,%H,^%D^,%ce,^%cN^,%ci,%ae,^%aN^,%ai,^%s^' --shortstat --tags -M20 -C20 origin/master ) > log.txt

# ..) | tee log.txt 
# -> will also print it out (with -a to append)

################################################################################
################################################################################
################################################################################

filename <- "log.txt"

col_names <- c("commit_hash","decorations","committer_email","committer_name","commit_time","author_email","author_name","author_time","commit_title",
               "files_changed","line_insertions","line_deletions")

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
    variables <- read_delim(file=I(paste0(line,",0,0,0")), delim=',', col_names = col_names, escape_double=FALSE, escape_backslash=TRUE, 
                            quote = '^', show_col_types = FALSE)
    # Maybe try data.table::fread, or read_files()
    
    # Remove the first element ("commit")
    variables <- variables[-1]
    
    # Set the right column names
    colnames(variables) <- col_names
    
    # Add to the 
    data <- bind_rows(data, variables)
    
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

# Write the data to a csv to use in the visual
write.csv(data, file = "commits.csv", row.names = F, na = "")

