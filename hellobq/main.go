package hellobq

import (
	"log"
	"net/http"
	"os"

	"cloud.google.com/go/bigquery"
	"github.com/GoogleCloudPlatform/functions-framework-go/functions"
	"google.golang.org/api/iterator"
)

func init() {
	functions.HTTP("helloBq", helloBq)
}

const queryTemplate = "SELECT word, word_count FROM `bigquery-public-data.samples.shakespeare` WHERE corpus = @corpus AND word_count >= @min_word_count ORDER BY word_count DESC"

func helloBq(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	projectID := os.Getenv("PROJECT_ID")
	clt, err := bigquery.NewClient(ctx, projectID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(err.Error()))
		log.Printf("bigQuery.NewClient failed; %v", err.Error())
		return
	}
	query := clt.Query(queryTemplate)
	query.Parameters = []bigquery.QueryParameter{
		{Name: "corpus", Value: "romeoandjuliet"},
		{Name: "min_word_count", Value: 400},
	}
	iter, err := query.Read(ctx)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(err.Error()))
		log.Printf("bigquery.Query.Read failed; %v", err.Error())
		return
	}
	for {
		var values []bigquery.Value
		err := iter.Next(&values)
		if err == iterator.Done {
			break
		}
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(err.Error()))
			log.Printf("iteration failed; %v", err.Error())
			continue
		}
		log.Printf("values: %v", values)
	}
}
