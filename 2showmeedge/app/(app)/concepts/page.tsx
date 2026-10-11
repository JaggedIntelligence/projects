import type { Metadata } from "next";
import { X } from "lucide-react";

import { ConceptsDocsInteractions } from "./concepts-docs-interactions";
import styles from "./concepts.module.css";

export const metadata: Metadata = {
  title: "simple-statistics-docs 7.8.7 | Documentation",
  description: "simple statistics documentation website"
};

export default function ConceptsPage() {
  return (
    <main className={styles.conceptsDocs} data-concepts-docs>
      <div className="flex">
        <div id="split-left" className="overflow-auto fs0 height-viewport-100">
          <div className="py1 px2">
            <h3 className="mb0 no-anchor">simple-statistics-docs</h3>
            <div className="mb1">
              <code>7.8.7</code>
            </div>
            <div className={styles.filterControl}>
              <input
                placeholder="Filter"
                id="filter-input"
                className={`col12 block input ${styles.filterInput}`}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                type="text"
              />
              <button
                type="button"
                className={styles.clearFilterButton}
                aria-label="Clear filter"
                data-filter-clear
                hidden
              >
                <X className={styles.clearFilterIcon} aria-hidden="true" />
              </button>
            </div>
            <div id="toc">
              <ul className="list-reset h5 py1-ul">
                <li>
                  <a href="#basic-descriptive-statistics" className="h5 bold black caps">
                    Basic Descriptive Statistics
                  </a>
                </li>

                <li>
                  <a href="#min" className="">
                    min
                  </a>
                </li>

                <li>
                  <a href="#max" className="">
                    max
                  </a>
                </li>

                <li>
                  <a href="#sum" className="">
                    sum
                  </a>
                </li>

                <li>
                  <a href="#sorted-basic-descriptive-statistics" className="h5 bold black caps">
                    Sorted Basic Descriptive Statistics
                  </a>
                </li>

                <li>
                  <a href="#minsorted" className="">
                    minSorted
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div id="split-gutter" className="gutter gutter-horizontal" aria-hidden="true" />

        <div id="split-right" className="relative overflow-auto height-viewport-100">
          <div className="keyline-top-not py2">
            <section className="py2 clearfix">
              <h2 id="basic-descriptive-statistics" className="mt0">
                Basic Descriptive Statistics
              </h2>
            </section>
          </div>

          <section className="p2 mb2 clearfix bg-white minishadow">
            <div className="clearfix">
              <h3 className="fl m0" id="min">
                min
              </h3>
            </div>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>
          </section>

          <section className="p2 mb2 clearfix bg-white minishadow">
            <div className="clearfix">
              <h3 className="fl m0" id="max">
                max222222 ----222
              </h3>
            </div>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>
          </section>

          <section className="p2 mb2 clearfix bg-white minishadow">
            <div className="clearfix">
              <h3 className="fl m0" id="sum">
                sum 33333 ----222
              </h3>
            </div>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>

            <p>
              The min is the lowest number in the array. This runs in <code>O(n)</code>, linear time, with respect to
              the length of the array.
            </p>
          </section>

          <section className="p2 mb2 clearfix bg-white minishadow" />
        </div>
      </div>

      <ConceptsDocsInteractions />
    </main>
  );
}
