const documentation = `
<h3>Description</h3>
<p>This website allows online access to all the contents of the INDOLOGY Forum for Classical South Asian
    studies. This forum started as a mailing list in November, 1990.</p>

<h3>Data description</h3>
<p>The data is in plain text format, and the main language used is English. Besides English,
    there are some other languages, as French, German, Sanskrit, etc., to name just a few, used to insert
    various words or expressions into the messages.
</p>
<h3>Data state</h3>
<p>As of December 2022, the Forum contained 59,832 messages (69.4MB), and 325,565 words and
    mispelled words.
</p>
<h3>Data processing</h3>
<p>In order to create the index for searching, some unused metadata and other redundant pieces of
    information were removed from the messages. However, the interface allows reading the raw contents
    of any message returned after a search, by pressing the link <code>full text</code>, located on
    the header of each message in the search result list.
</p>
<h3>Data storage</h3>
<p>The whole website is a static website, which means that its pages or search results are not generated
    dynamically from a database, based upon a template, but are stored as they are in a filesystem, and
    served by a plain webserver. The same is valid for indexes used for searching.</p>
<p>A static website has, among other advantages: free hosting, fast rendering, and a better
    protection against hacking.</p>
<h3>Data searching</h3>
<h5>Algorithms</h5>
<p>Due to the structure of the data, which contains mispelled words
    or simply words with non-ASCII characters that were replaced by the
    mailing list software with question marks, I found that, along with
    the exact search type, some fuzzy search algorithms are needed.
</p>
<p>
    For this reason, I have added the following fuzzy search types:
</p>
<ol>
    <li>prefix search, which will return all the words starting
        with the search term;</li>
    <li>two search types using Levenstein distance of one, respectively two differences
        (addition, deletion, or replacement) to the correct word form;</li>
    <li>ngram search, which uses an index built by segmenting the words in character bigrams (tokens of two
        characters), will return suggestions that are different by the search term based upon a similarity threshold
        having a fixed value of 0.7 (70%)</li>
</ol>        
<h5>Procedure for fuzzy search</h5>
<p>In case when the exact search dows not return any or helpful results, one can
    extend the search by selecting one or more search types, to get more suggestions
    for each search term. Just select any combination of suggestions, and press the button
    <code>Search by suggestions</code>.
</p>
`;

export {
    documentation
};