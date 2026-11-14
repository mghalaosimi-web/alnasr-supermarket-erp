# AL-NASR custom runtime image.
# ERPNext base is pinned; X POS and AL-NASR are added from immutable repository submodules.
FROM frappe/erpnext:v16.55.0

USER root
COPY --chown=frappe:frappe apps/xpos /home/frappe/frappe-bench/apps/xpos
COPY --chown=frappe:frappe apps/alnasr /home/frappe/frappe-bench/apps/alnasr

USER frappe
WORKDIR /home/frappe/frappe-bench

# Install the pinned X POS and AL-NASR Python apps into the Bench environment.
RUN ./env/bin/pip install --no-cache-dir -e ./apps/xpos -e ./apps/alnasr

# Build the exact pinned X POS frontend and register its assets with Frappe.
RUN cd apps/xpos/frontend \
    && yarn install --frozen-lockfile \
    && yarn build \
    && cd /home/frappe/frappe-bench \
    && bench build --app xpos
