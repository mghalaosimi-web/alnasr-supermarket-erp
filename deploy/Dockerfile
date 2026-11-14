# AL-NASR custom runtime image.
# Base image is pinned to the ERPNext v16 release validated by the project.
FROM frappe/erpnext:v16.55.0
USER root
COPY --chown=frappe:frappe apps/alnasr /home/frappe/frappe-bench/apps/alnasr
RUN /home/frappe/frappe-bench/env/bin/pip install --no-deps -e /home/frappe/frappe-bench/apps/alnasr \
    && chown -R frappe:frappe /home/frappe/frappe-bench/apps/alnasr
USER frappe
WORKDIR /home/frappe/frappe-bench
